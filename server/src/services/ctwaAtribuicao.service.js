'use strict';

// ─── Atribuição de Click-to-WhatsApp (CTWA) ────────────────────────────────────
// Lead que chega por anúncio CTWA traz, na PRIMEIRA mensagem, um objeto `referral`
// (Cloud API, messages webhook). Campos documentados pela Meta: source_url,
// source_id (= ID do anúncio), source_type ('ad'), body, headline, media_type,
// image_url, video_url, thumbnail_url, ctwa_clid (ausente em anúncios no Status),
// welcome_message.text. NÃO vem adset/campanha nem nomes — esses saem da Graph API
// pelo ID do anúncio, em segundo plano.
//
// Tudo aqui é best-effort e nunca lança: ausência de referral é o caso normal, e
// qualquer falha só vai pro log — criação do lead e triagem seguem intactas.

const prisma = require('../lib/prisma');

const GRAPH_VERSION = 'v21.0'; // mesma versão da sincronização de gastos (adSpend.service.js)
const LOG = '[ctwa]';
const PENDENTE_TTL = 24 * 60 * 60 * 1000;
const GRAPH_TIMEOUT_MS = 10000;

// Com triagem ligada o lead só nasce algumas mensagens depois da que trouxe o
// referral — guarda até lá. Memória (mesmo padrão dos caches do webhook): restart
// no meio da triagem perde a atribuição, o lead é criado normalmente sem ela.
const pendentes = new Map(); // "imobiliariaId:telefone" → { referral, ts }

setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of pendentes) if (agora - v.ts > PENDENTE_TTL) pendentes.delete(k);
}, 30 * 60 * 1000).unref();

function sanitizarTexto(valor) {
  if (valor == null) return null;
  return String(valor)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 500);
}

// Só os campos que usamos; formato inesperado → null + log (nunca lança)
function extrairReferral(msg) {
  const r = msg?.referral;
  if (r == null) return null;
  if (typeof r !== 'object' || Array.isArray(r)) {
    console.warn(`${LOG} referral com formato inesperado (${typeof r}) — ignorado`);
    return null;
  }
  const adId = r.source_type === 'ad' && /^\d+$/.test(String(r.source_id || '')) ? String(r.source_id) : null;
  const ctwaClid = typeof r.ctwa_clid === 'string' && r.ctwa_clid.trim() ? r.ctwa_clid.trim().slice(0, 500) : null;
  if (!adId && !ctwaClid) {
    console.warn(`${LOG} referral sem source_id de anúncio nem ctwa_clid (source_type=${r.source_type}) — ignorado`);
    return null;
  }
  return { adId, ctwaClid };
}

// Chamado em toda mensagem de número desconhecido; só guarda quando há referral
function registrarReferral(imobiliariaId, telefone, msg) {
  try {
    const referral = extrairReferral(msg);
    if (!referral) return;
    pendentes.set(`${imobiliariaId}:${telefone}`, { referral, ts: Date.now() });
    console.log(`${LOG} referral recebido imob=${imobiliariaId} adId=${referral.adId || '-'} ctwa_clid=${referral.ctwaClid ? 'sim' : 'não'}`);
  } catch (err) {
    console.error(`${LOG} erro ao registrar referral:`, err.message);
  }
}

// Logo após o lead nascer: grava adId + ctwa_clid + origem na hora (ficam mesmo se
// a Graph falhar — a tabela adSpend já resolve o nome do anúncio pelo adId) e
// dispara o enriquecimento sem aguardar.
async function aplicarAtribuicaoCtwa(leadId, imobiliariaId, telefone) {
  try {
    const chave = `${imobiliariaId}:${telefone}`;
    const pendente = pendentes.get(chave);
    if (!pendente) return;
    pendentes.delete(chave);
    const { adId, ctwaClid } = pendente.referral;

    await prisma.lead.update({
      where: { id: leadId },
      data: { origem: 'Meta Ads', adId, ctwaClid },
    });
    console.log(`${LOG} atribuição gravada lead=${leadId} adId=${adId || '-'} ctwa_clid=${ctwaClid ? 'sim' : 'não'}`);

    if (adId) {
      enriquecerViaGraph(leadId, imobiliariaId, adId).catch((err) => {
        console.error(`${LOG} erro inesperado no enriquecimento lead=${leadId}:`, err.message);
      });
    }
  } catch (err) {
    console.error(`${LOG} erro ao aplicar atribuição lead=${leadId}:`, err.message);
  }
}

// Lead que JÁ EXISTE clicou num anúncio CTWA de novo: a atribuição original fica
// intacta, mas o retorno vai pro histórico — senão some a informação de que a
// campanha nova trouxe de volta um lead antigo.
async function registrarRetornoPorAnuncio(leadId, msg) {
  try {
    const referral = extrairReferral(msg);
    if (!referral?.adId) return;

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { adId: true } });
    if (!lead) return;

    const quando = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const mesmoAnuncio = lead.adId === referral.adId;
    let acao, original = '';
    if (mesmoAnuncio) {
      acao = 'Lead voltou pelo mesmo anúncio (Click-to-WhatsApp)';
    } else if (lead.adId) {
      acao = 'Lead voltou por outro anúncio (Click-to-WhatsApp)';
      original = ` | Atribuição original mantida (anúncio ${lead.adId})`;
    } else {
      acao = 'Lead voltou por um anúncio (Click-to-WhatsApp)';
      original = ' | Lead original sem atribuição de anúncio — mantido assim';
    }
    await prisma.historicoLead.create({
      data: { leadId, acao, detalhes: `Anúncio: ${referral.adId} | Data: ${quando}${original}` },
    });
    console.log(`${LOG} lead existente voltou por anúncio lead=${leadId} adId=${referral.adId} original=${lead.adId || '-'}`);
  } catch (err) {
    console.error(`${LOG} erro ao registrar retorno por anúncio lead=${leadId}:`, err.message);
  }
}

// Permissão de anúncios não concedida (ex: "(#200) ... ads_management") é caso
// esperado em algumas imobiliárias: loga e segue. Uma tentativa por lead, sem retry.
function ehErroPermissao(erro) {
  const code = erro?.code;
  return code === 10 || (code >= 200 && code <= 299) // faixas de erro de permissão da Graph API
    || /ads_management|ads_read|permission/i.test(erro?.message || '');
}

async function enriquecerViaGraph(leadId, imobiliariaId, adId) {
  const integracao = await prisma.metaIntegracao.findFirst({
    where: { imobiliariaId, ativo: true, adsToken: { not: null } },
    select: { adsToken: true },
  });
  if (!integracao) {
    console.log(`${LOG} sem integração Meta Ads ativa imob=${imobiliariaId} — lead=${leadId} fica só com adId`);
    return;
  }

  const params = new URLSearchParams({
    fields: 'name,adset{id,name},campaign{id,name}',
    access_token: integracao.adsToken,
  });
  let resp, json;
  try {
    resp = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${adId}?${params}`, {
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    json = await resp.json().catch(() => ({}));
  } catch (err) {
    console.warn(`${LOG} Graph indisponível para adId=${adId} lead=${leadId}: ${err.message} — fica só com adId`);
    return;
  }

  if (!resp.ok) {
    const erro = json?.error;
    if (ehErroPermissao(erro)) {
      console.warn(`${LOG} sem permissão de anúncios imob=${imobiliariaId} (code=${erro?.code}) — lead=${leadId} fica só com adId`);
    } else {
      console.error(`${LOG} Graph recusou adId=${adId} lead=${leadId}: code=${erro?.code} ${erro?.message || `HTTP ${resp.status}`}`);
    }
    return;
  }

  const dados = {
    anuncioName: sanitizarTexto(json.name),
    adsetId: json.adset?.id ? String(json.adset.id) : null,
    conjuntoName: sanitizarTexto(json.adset?.name),
    campaignId: json.campaign?.id ? String(json.campaign.id) : null,
    campanha: sanitizarTexto(json.campaign?.name),
  };
  // Só sobrescreve com o que veio — não apaga o que já existia (ex: campanha detectada no texto)
  const data = Object.fromEntries(Object.entries(dados).filter(([, v]) => v));
  if (!Object.keys(data).length) return;

  await prisma.lead.update({ where: { id: leadId }, data });
  console.log(`${LOG} lead=${leadId} enriquecido: campanha="${data.campanha || '-'}" conjunto="${data.conjuntoName || '-'}" anúncio="${data.anuncioName || '-'}"`);
}

module.exports = { registrarReferral, aplicarAtribuicaoCtwa, registrarRetornoPorAnuncio, extrairReferral };
