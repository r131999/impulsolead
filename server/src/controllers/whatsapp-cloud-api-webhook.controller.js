'use strict';

// ─── Webhook de mensagens recebidas — WhatsApp Cloud API ───────────────────────
// Equivalente ao handleMessage de server/whatsapp/manager.js (Baileys), mas
// rodando DENTRO do processo da API principal (o webhook da Cloud API já cai
// aqui, em vez de num processo separado) — por isso chama processarTriagemCore/
// processarQualificacaoCore/receberLeadCore direto, sem o hop HTTP que o manager
// precisa dar (e sem a fila de retry que esse hop exige: erro aqui é erro de
// banco, não de rede, e se propaga normal).
//
// Pequenas peças puras (detecção de campanha, normalização de telefone, horário
// de atendimento) estão duplicadas do manager.js de propósito: são dois processos
// deployados separadamente (manager.js é outro serviço/container), não dá pra
// importar um do outro.

const prisma = require('../lib/prisma');
const { processarTriagemCore, processarQualificacaoCore } = require('./agente.controller');
const { receberLeadCore, buscarTelefonesBloqueados, buscarLeadAtivoCore, buscarConfigAtendimento } = require('./webhook.controller');
const { salvarMensagemRecebidaCore } = require('./chat-lead.controller');
const { enviarTextoLivre, marcarLidoComDigitando } = require('../services/whatsappCloudApi.service');

// ── Estado em memória (melhor esforço — não sobrevive a restart/múltiplas instâncias,
// mesma limitação que o manager.js já tem hoje como processo único) ────────────
const MSG_DEDUPE_TTL       = 30 * 60 * 1000;  // 30 min
const RECENT_LEAD_TTL      = 24 * 60 * 60 * 1000; // 24 h
const CONTEUDO_DEDUPE_TTL  = 5  * 60 * 1000;  // 5 min
const BLOCKED_CACHE_TTL    = 10 * 60 * 1000;  // 10 min
const CLEANUP_INTERVAL     = 5  * 60 * 1000;  // 5 min

const seenMsgIds    = new Map(); // msgId → timestamp
const recentLeads    = new Map(); // "imobiliariaId:telefone" → timestamp
const dedupeConteudo = new Map(); // "imobiliariaId:texto" → timestamp
const blockedCache   = new Map(); // imobiliariaId → { set, expiraEm }
const filaPorImobiliaria = new Map(); // imobiliariaId → Promise (processamento sequencial)

setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of seenMsgIds) if (now - ts > MSG_DEDUPE_TTL) seenMsgIds.delete(k);
  for (const [k, ts] of recentLeads) if (now - ts > RECENT_LEAD_TTL) recentLeads.delete(k);
  for (const [k, ts] of dedupeConteudo) if (now - ts > CONTEUDO_DEDUPE_TTL) dedupeConteudo.delete(k);
}, CLEANUP_INTERVAL);

// ── Helpers puros (duplicados do manager.js — ver nota no topo do arquivo) ─────

const CAMPAIGN_PATTERNS = [
  /quero mais informa[çc][oõ]es (?:do|sobre o|da)\s+(.+?)\.?$/i,
  /vim\s+pel[ao]\s+(.+)/i,
  /vim\s+d[ao]\s+(.+)/i,
  /interesse\s+n[oa]\s+(.+)/i,
  /indicad[ao]\s+pel[ao]\s+(.+)/i,
  /vi\s+n[ao]\s+(.+)/i,
  /tenho interesse e queria mais informa/i,
];

function detectCampaign(text) {
  if (!text) return null;
  for (const p of CAMPAIGN_PATTERNS) {
    const m = text.match(p);
    if (m) return m[1] ? m[1].trim().slice(0, 100) : 'Anúncio';
  }
  return null;
}

// 559888123187 (12 dígitos) → 5598988123187 (13 dígitos)
function normalizarTelefone(phone) {
  if (phone.length === 12 && phone.startsWith('55') && phone[4] !== '9') {
    return phone.slice(0, 4) + '9' + phone.slice(4);
  }
  return phone;
}

// Brasília = UTC-3, sem horário de verão — mesma convenção usada em cron.service.js
function dentroDoHorarioAtendimento({ horarioAtendimentoInicio, horarioAtendimentoFim }) {
  const agoraBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const minutosAgora = agoraBrasilia.getUTCHours() * 60 + agoraBrasilia.getUTCMinutes();

  const [hi, mi] = horarioAtendimentoInicio.split(':').map(Number);
  const [hf, mf] = horarioAtendimentoFim.split(':').map(Number);
  const minutosInicio = hi * 60 + mi;
  const minutosFim = hf * 60 + mf;

  if (minutosInicio <= minutosFim) {
    return minutosAgora >= minutosInicio && minutosAgora <= minutosFim;
  }
  return minutosAgora >= minutosInicio || minutosAgora <= minutosFim; // janela atravessa a meia-noite
}

function extrairTexto(msg) {
  if (msg.type === 'text') return msg.text?.body || '';
  if (msg.type === 'image') return msg.image?.caption || '';
  if (msg.type === 'video') return msg.video?.caption || '';
  return '';
}

// ── Envio com indicador de "digitando..." — equivalente do enviarComDigitacao do
// manager.js, mas via marcarLidoComDigitando (read + typing_indicator) em vez de
// sendPresenceUpdate. Falha ao mostrar o indicador nunca pode impedir o envio.
async function enviarComDigitando(credenciais, telefone, texto, delayMs, msgId) {
  if (msgId) {
    await marcarLidoComDigitando(msgId, credenciais).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, delayMs || 1200));
  return enviarTextoLivre(telefone, texto, credenciais);
}

async function buscarBloqueadosCache(imobiliariaId) {
  const cache = blockedCache.get(imobiliariaId);
  if (cache && Date.now() < cache.expiraEm) return cache.set;

  const telefones = await buscarTelefonesBloqueados(imobiliariaId);
  const set = new Set(telefones);
  blockedCache.set(imobiliariaId, { set, expiraEm: Date.now() + BLOCKED_CACHE_TTL });
  return set;
}

async function resolverInstanciaCloudApi(phoneNumberId) {
  return prisma.whatsappCloudApiInstancia.findUnique({
    where: { phoneNumberId },
    select: { imobiliariaId: true, phoneNumberId: true, accessToken: true, ativo: true },
  });
}

// ── Criação de lead + mensagem inicial ──────────────────────────────────────────
// Sem fila de retry (ver nota no topo): é chamada direta em processo, erro de
// banco aqui é o mesmo tipo de falha que qualquer outra rota da API já tem.
async function criarLeadEEnviarMsgInicial({ imobiliariaId, phone, jid, text, msgId, nome, campanha, viaAgenteQualificacao }) {
  const resultado = await receberLeadCore({
    nome,
    telefone: phone,
    whatsappJid: jid,
    campanha: campanha || undefined,
    viaAgenteQualificacao: viaAgenteQualificacao || undefined,
    mensagemInicial: text || undefined,
  }, imobiliariaId);

  if (resultado.status !== 201) {
    console.error(`[whatsapp-cloud-api] Falha ao criar lead (${phone}):`, resultado.body);
    return;
  }

  const leadId = resultado.body?.lead?.id;
  // historicoBackfilled === true: a mensagem já entrou no chat via o histórico de
  // triagem gravado retroativamente — logar de novo aqui duplicaria a mensagem.
  if (leadId && text && !resultado.body?.historicoBackfilled) {
    await salvarMensagemRecebidaCore({
      leadId, imobiliariaId, conteudo: text, whatsappMsgId: msgId, remetenteNome: nome, tipoMidia: 'texto',
    });
  }
}

// ── Processamento de uma mensagem ───────────────────────────────────────────────
async function processarMensagem({ imobiliariaId, phoneNumberId, accessToken }, msg, contato) {
  const msgId = msg.id;
  if (!msgId || seenMsgIds.has(msgId)) return;
  seenMsgIds.set(msgId, Date.now());

  const text = extrairTexto(msg).trim();
  if (!text) return; // sem suporte a mídia sem legenda / outros tipos (áudio, localização etc.) por ora

  const phone = normalizarTelefone(String(msg.from || '').replace(/\D/g, ''));
  if (!phone) return;

  const nome = contato?.profile?.name?.trim() || 'Lead WhatsApp';
  const jid = `${phone}@s.whatsapp.net`;
  const credenciais = { phoneNumberId, accessToken };

  const bloqueados = await buscarBloqueadosCache(imobiliariaId);
  if (bloqueados.has(phone)) return; // mensagem de corretor/gestor da própria imobiliária

  // ── CAMINHO 1: lead existente ─────────────────────────────────────────────
  const leadAtivo = await buscarLeadAtivoCore({ imobiliariaId, telefone: phone, jid });

  if (leadAtivo.existe && leadAtivo.leadId) {
    if (leadAtivo.emQualificacaoAutomatica) {
      const resultado = await processarQualificacaoCore({
        telefone: phone, mensagem: text, instancia: imobiliariaId, pushName: nome, whatsappMsgId: msgId, imobiliariaId,
      });
      if (resultado.body?.mensagemResposta) {
        await enviarComDigitando(credenciais, phone, resultado.body.mensagemResposta, resultado.body.delayMs, msgId).catch((err) => {
          console.error(`[whatsapp-cloud-api] Erro ao enviar resposta de qualificação (${phone}):`, err.message);
        });
      }
      return;
    }

    await salvarMensagemRecebidaCore({
      leadId: leadAtivo.leadId, imobiliariaId, conteudo: text, whatsappMsgId: msgId, remetenteNome: nome, tipoMidia: 'texto',
    });
    return;
  }

  // ── CAMINHO 2/3: número desconhecido ────────────────────────────────────────
  const configAtendimento = await buscarConfigAtendimento(imobiliariaId);

  if (!dentroDoHorarioAtendimento(configAtendimento)) return;

  if (!configAtendimento.atenderNumeroDesconhecido) {
    // Direto — cria lead sem triagem (comportamento padrão)
    const chaveRecente = `${imobiliariaId}:${phone}`;
    if (recentLeads.has(chaveRecente)) return;

    const chaveConteudo = `${imobiliariaId}:${text.toLowerCase().slice(0, 50)}`;
    const tsConteudo = dedupeConteudo.get(chaveConteudo);
    if (tsConteudo && Date.now() - tsConteudo < CONTEUDO_DEDUPE_TTL) return;
    dedupeConteudo.set(chaveConteudo, Date.now());

    const campanha = detectCampaign(text);

    await enviarTextoLivre(phone, configAtendimento.mensagem, credenciais).catch((err) => {
      console.error(`[whatsapp-cloud-api] Erro ao enviar boas-vindas (${phone}):`, err.message);
    });
    await new Promise((r) => setTimeout(r, 1000));

    recentLeads.set(chaveRecente, Date.now());

    await criarLeadEEnviarMsgInicial({
      imobiliariaId, phone, jid, text, msgId, nome, campanha,
      viaAgenteQualificacao: configAtendimento.qualificacaoAutomatica,
    });
    return;
  }

  // Triagem — ConfigAgente.atenderNumeroDesconhecido = true
  const resultadoTriagem = await processarTriagemCore({
    telefone: phone, mensagem: text, instancia: imobiliariaId, pushName: nome, imobiliariaId,
  });
  const corpo = resultadoTriagem.body;

  if (corpo?.mensagemResposta) {
    await enviarComDigitando(credenciais, phone, corpo.mensagemResposta, corpo.delayMs, msgId).catch((err) => {
      console.error(`[whatsapp-cloud-api] Erro ao enviar resposta de triagem (${phone}):`, err.message);
    });
  }

  if (corpo?.acao === 'lead_confirmado') {
    recentLeads.set(`${imobiliariaId}:${phone}`, Date.now());
    await criarLeadEEnviarMsgInicial({
      imobiliariaId, phone, jid, text, msgId, nome, campanha: detectCampaign(text),
      viaAgenteQualificacao: configAtendimento.qualificacaoAutomatica,
    });
  }
}

// Encadeia o processamento por imobiliária — evita que duas mensagens do mesmo
// lead, chegando próximas no tempo, rodem processarMensagem em paralelo e corram
// na criação de sessão/lead (mesma razão da filaProcessamento em manager.js).
function enfileirar(imobiliariaId, tarefa) {
  const atual = filaPorImobiliaria.get(imobiliariaId) || Promise.resolve();
  const proxima = atual
    .then(tarefa)
    .catch((err) => console.error(`[whatsapp-cloud-api] Erro na fila (${imobiliariaId}):`, err.message));
  filaPorImobiliaria.set(imobiliariaId, proxima);
}

// POST /api/webhook/whatsapp (changes[].value.messages[]) — chamado pela rota
// depois de já validar X-Hub-Signature-256 (verificarAssinaturaMeta).
async function receberWebhookMensagens(req, res) {
  // Responde rápido, sempre — a Meta reenvia em timeout/erro, e o processamento
  // real (classificação via IA, criação de lead) pode levar alguns segundos.
  res.sendStatus(200);

  try {
    const entradas = req.body?.entry || [];
    for (const entry of entradas) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        if (!Array.isArray(value.messages) || value.messages.length === 0) continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const instancia = await resolverInstanciaCloudApi(phoneNumberId);
        if (!instancia || !instancia.ativo) {
          console.warn(`[whatsapp-cloud-api] phone_number_id sem imobiliária ativa: ${phoneNumberId}`);
          continue;
        }

        const contatos = value.contacts || [];
        for (const msg of value.messages) {
          const contato = contatos.find((c) => c.wa_id === msg.from);
          enfileirar(instancia.imobiliariaId, () => processarMensagem(instancia, msg, contato));
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp-cloud-api] Erro no webhook:', err.message);
  }
}

module.exports = { receberWebhookMensagens };
