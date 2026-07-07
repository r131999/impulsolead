const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { notificarCorretor } = require('../services/notificacao.service');
const { enviarPushCorretor } = require('./push.controller');

function sanitizarTexto(valor) {
  if (valor == null) return null;
  return String(valor)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 500);
}

function normalizarTelefone(telefone) {
  if (!telefone) return null;
  const digitos = String(telefone).replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) return null;
  return digitos;
}

// Cria o lead e distribui para o próximo corretor da fila (ou marca para distribuição
// manual/sem corretor disponível), independente da origem (Meta Ads, Make, etc).
async function criarLeadEDistribuir({
  nome, telefone, origem, campanha, conjuntoName, anuncioName,
  adId, adsetId, campaignId, imobiliariaId, imobiliaria,
}) {
  const configAgente = await prisma.configAgente.findUnique({
    where: { imobiliariaId },
    select: { distribuicaoManual: true },
  });
  const modoManual = configAgente?.distribuicaoManual ?? false;

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        nome,
        telefone,
        whatsappJid: `${telefone}@s.whatsapp.net`,
        status: 'lead',
        origem,
        campanha: campanha || null,
        conjuntoName: conjuntoName || null,
        anuncioName: anuncioName || null,
        adId: adId || null,
        adsetId: adsetId || null,
        campaignId: campaignId || null,
        imobiliariaId,
      },
    });

    if (modoManual) {
      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: `Lead recebido via ${origem} — aguardando distribuição manual`,
        },
      });
      return { lead, corretor: null };
    }

    const corretores = await tx.corretor.findMany({
      where: { imobiliariaId, ativo: true, disponivel: true },
      orderBy: { posicaoFila: 'asc' },
    });

    let corretor = null;

    if (corretores.length > 0) {
      const proximo = corretores[0];
      const maxPosicao = corretores[corretores.length - 1].posicaoFila;

      await tx.corretor.update({
        where: { id: proximo.id },
        data: { leadsRecebidos: { increment: 1 }, posicaoFila: maxPosicao + 1 },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { corretorId: proximo.id },
      });

      corretor = proximo;

      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: `Lead recebido via ${origem} e atribuído automaticamente`,
          detalhes: `Corretor: ${proximo.nome}`,
        },
      });

      await tx.historicoDistribuicao.create({
        data: {
          leadId: lead.id,
          leadNome: nome,
          leadTelefone: telefone,
          corretorId: proximo.id,
          corretorNome: proximo.nome,
          distribuidoPor: 'automatico',
          imobiliariaId,
        },
      });
    } else {
      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: `Lead recebido via ${origem} — sem corretor disponível na fila`,
        },
      });
    }

    return { lead, corretor };
  });

  if (result.corretor) {
    notificarCorretor(result.corretor, result.lead, imobiliaria).catch(() => {});
    enviarPushCorretor(
      result.corretor.id,
      '🏠 Novo lead!',
      `Nome: ${result.lead.nome} | Tel: ${result.lead.telefone}`,
    ).catch(() => {});
  }

  return result;
}

// GET /api/integracoes/meta/webhook — verificação do webhook pelo Meta
async function verificarWebhookMeta(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Verificação falhou' });
}

// POST /api/integracoes/meta/webhook — receber leads do Meta Lead Ads
async function receberLeadMeta(req, res) {
  res.status(200).json({ received: true });

  try {
    const body = req.body;
    if (!body || !Array.isArray(body.entry)) return;

    for (const entry of body.entry) {
      const pageId = entry.id;
      if (!pageId) continue;

      const integracao = await prisma.metaIntegracao.findFirst({
        where: { pageId, ativo: true },
        include: { imobiliaria: true },
      });
      if (!integracao) continue;

      const { imobiliariaId, imobiliaria } = integracao;

      for (const change of (entry.changes || [])) {
        if (change.field !== 'leadgen') continue;
        const value = change.value || {};

        const leadgenId = value.leadgen_id;
        if (!leadgenId) continue;

        console.log(`[meta-webhook] Recebido leadgen_id: ${leadgenId} página: ${pageId}`);

        let leadData;
        try {
          const r = await fetch(
            `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,created_time,ad_name,adset_name,campaign_name,form_id,ad_id,adset_id,campaign_id&access_token=${integracao.pageToken}`
          );
          leadData = await r.json();
          if (leadData.error) {
            console.error(`[meta-webhook] Erro ao buscar lead ${leadgenId}:`, leadData.error.message);
            continue;
          }
        } catch (e) {
          console.error(`[meta-webhook] Erro ao buscar lead ${leadgenId}:`, e.message);
          continue;
        }

        const fieldData = leadData.field_data || [];

        const normStr = (s) =>
          String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

        // Nome: 1º canônico full_name, 2º campo cujo nome contenha 'nome'/'name'
        const nome =
          fieldData.find((f) => f.name === 'full_name')?.values?.[0] ??
          (() => {
            for (const f of fieldData) {
              const n = normStr(f.name);
              if ((n.includes('nome') || n.includes('name')) && f?.values?.[0]) return f.values[0];
            }
            return null;
          })();

        // Telefone — 3 prioridades:
        // 1º canônico phone_number (campo padrão do Meta, independe do idioma)
        // 2º campo cujo nome normalizado contenha keyword de telefone
        // 3º fallback regex: prefere +55 (score 3) > começa com 55 (score 2) > 10-13 dígitos (score 1)
        const phoneKeywords = ['telefone', 'telefono', 'telemovel', 'celular', 'whatsapp', 'whats', 'contato', 'fone', 'phone', 'numero'];
        const telefone =
          fieldData.find((f) => f.name === 'phone_number')?.values?.[0] ??
          (() => {
            for (const f of fieldData) {
              if (phoneKeywords.some((kw) => normStr(f.name).includes(kw)) && f?.values?.[0]) return f.values[0];
            }
            return null;
          })() ??
          (() => {
            let best = null;
            let bestScore = 0;
            for (const f of fieldData) {
              const val = f?.values?.[0];
              if (!val) continue;
              const str = String(val);
              const digits = str.replace(/\D/g, '');
              const score = str.includes('+55') ? 3
                : digits.startsWith('55') ? 2
                : (digits.length >= 10 && digits.length <= 13) ? 1
                : 0;
              if (score > bestScore) { bestScore = score; best = val; }
              if (bestScore === 3) break;
            }
            return best;
          })();

        const email = fieldData.find((f) => f.name === 'email')?.values?.[0] ?? null;
        const campanha = sanitizarTexto(leadData.campaign_name || fieldData.find((f) => f.name === 'campaign_name')?.values?.[0] || value.campaign_name || null);
        const conjuntoName = sanitizarTexto(leadData.adset_name || fieldData.find((f) => f.name === 'adset_name')?.values?.[0] || value.adset_name || null);
        const anuncioName = sanitizarTexto(leadData.ad_name || fieldData.find((f) => f.name === 'ad_name')?.values?.[0] || value.ad_name || null);

        const fieldNames = fieldData.map((f) => f.name).join(', ');
        console.log(`[meta-webhook] Dados do lead buscados: nome="${nome}" telefone="${telefone}" | campos: ${fieldNames}`);

        if (!nome) {
          console.warn(`[meta-webhook] Lead ${leadgenId} descartado: nome não encontrado | campos: ${fieldNames}`);
          continue;
        }

        const nomeSanitizado = sanitizarTexto(nome);

        if (!telefone) {
          console.error('[meta-webhook] telefone nao identificado', { leadgen_id: leadgenId, field_data: fieldData });
          continue;
        }

        const digitos = normalizarTelefone(telefone);
        if (!digitos) {
          console.warn(`[meta-webhook] Lead ${leadgenId} descartado: telefone "${telefone}" fora do range de 10–15 dígitos`);
          continue;
        }

        const result = await criarLeadEDistribuir({
          nome: nomeSanitizado,
          telefone: digitos,
          origem: 'Meta Ads',
          campanha,
          conjuntoName,
          anuncioName,
          adId: leadData.ad_id,
          adsetId: leadData.adset_id,
          campaignId: leadData.campaign_id,
          imobiliariaId,
          imobiliaria,
        });

        console.log(`[meta-webhook] Lead criado: ${result.lead.id}`);
      }
    }
  } catch (err) {
    console.error('[meta-webhook] Erro ao processar lead:', err.message);
  }
}

// GET /api/integracoes/meta/status
async function statusMeta(req, res) {
  const integracao = await prisma.metaIntegracao.findUnique({
    where: { imobiliariaId: req.imobiliariaId },
    select: { pageId: true, pageName: true, ativo: true, criadoEm: true },
  });
  const conectado = !!integracao?.ativo && !!integracao?.pageId;
  res.json({
    ativo: conectado,
    pageId: conectado ? integracao.pageId : null,
    pageName: conectado ? (integracao.pageName || null) : null,
    criadoEm: conectado ? integracao.criadoEm : null,
  });
}

// POST /api/integracoes/meta/conectar
async function conectarMeta(req, res) {
  const { pageId, pageToken } = req.body;
  if (!pageId || !pageToken) {
    return res.status(400).json({ error: 'pageId e pageToken são obrigatórios' });
  }

  const integracao = await prisma.metaIntegracao.upsert({
    where: { imobiliariaId: req.imobiliariaId },
    update: {
      pageId: pageId.trim(),
      pageToken: pageToken.trim(),
      ativo: true,
      adsToken: process.env.META_SYSTEM_USER_TOKEN,
    },
    create: {
      imobiliariaId: req.imobiliariaId,
      pageId: pageId.trim(),
      pageToken: pageToken.trim(),
      adsToken: process.env.META_SYSTEM_USER_TOKEN,
    },
  });

  res.json({ success: true, pageId: integracao.pageId });
}

// DELETE /api/integracoes/meta/desconectar
async function desconectarMeta(req, res) {
  // pageId e pageToken são colunas obrigatórias no schema (não aceitam null), então não são
  // zerados aqui — apenas ativo:false, que já é o que statusMeta e o webhook usam para tratar
  // a integração como desconectada. adAccountId e adsToken ficam intactos para a reconexão.
  await prisma.metaIntegracao.updateMany({
    where: { imobiliariaId: req.imobiliariaId },
    data: { ativo: false },
  });
  res.json({ success: true });
}

// POST /api/integracoes/make/webhook/:token — receber leads via Make (Integromat),
// via alternativa para quando a conexão direta com a Meta falhar.
async function receberLeadMake(req, res) {
  const { token } = req.params;

  const integracao = await prisma.makeIntegracao.findFirst({
    where: { token, ativo: true },
    include: { imobiliaria: true },
  });
  if (!integracao) {
    return res.status(404).json({ error: 'Integração não encontrada ou inativa' });
  }

  const { imobiliariaId, imobiliaria } = integracao;
  const body = req.body || {};

  const nome = sanitizarTexto(body.nome);
  if (!nome) {
    return res.status(400).json({ error: 'nome é obrigatório' });
  }

  const digitos = normalizarTelefone(body.telefone);
  if (!digitos) {
    return res.status(400).json({ error: 'telefone é obrigatório e deve ter entre 10 e 15 dígitos' });
  }

  const result = await criarLeadEDistribuir({
    nome,
    telefone: digitos,
    origem: 'Make',
    campanha: sanitizarTexto(body.campanha),
    conjuntoName: sanitizarTexto(body.conjuntoName),
    anuncioName: sanitizarTexto(body.anuncioName),
    adId: null,
    adsetId: null,
    campaignId: null,
    imobiliariaId,
    imobiliaria,
  });

  await prisma.makeIntegracao.update({
    where: { id: integracao.id },
    data: { ultimoUsoEm: new Date() },
  });

  res.status(200).json({ received: true, leadId: result.lead.id });
}

function urlWebhookMake(req, token) {
  return `${req.protocol}://${req.get('host')}/api/integracoes/make/webhook/${token}`;
}

// POST /api/integracoes/make/gerar-token — idempotente: se já existe um token, devolve o
// mesmo (reativando se estava desativado), sem invalidar links já configurados no Make.
async function gerarTokenMake(req, res) {
  const existente = await prisma.makeIntegracao.findUnique({
    where: { imobiliariaId: req.imobiliariaId },
  });

  if (existente) {
    if (!existente.ativo) {
      await prisma.makeIntegracao.update({
        where: { id: existente.id },
        data: { ativo: true },
      });
    }
    return res.json({ success: true, url: urlWebhookMake(req, existente.token) });
  }

  const token = crypto.randomBytes(24).toString('hex');
  await prisma.makeIntegracao.create({
    data: { imobiliariaId: req.imobiliariaId, token },
  });

  res.json({ success: true, url: urlWebhookMake(req, token) });
}

// POST /api/integracoes/make/regenerar-token — ação explícita e destrutiva: troca o token,
// invalidando qualquer link do Make já configurado com o anterior.
async function regenerarTokenMake(req, res) {
  const token = crypto.randomBytes(24).toString('hex');

  await prisma.makeIntegracao.upsert({
    where: { imobiliariaId: req.imobiliariaId },
    update: { token, ativo: true },
    create: { imobiliariaId: req.imobiliariaId, token },
  });

  res.json({ success: true, url: urlWebhookMake(req, token) });
}

module.exports = {
  verificarWebhookMeta,
  receberLeadMeta,
  statusMeta,
  conectarMeta,
  desconectarMeta,
  receberLeadMake,
  gerarTokenMake,
  regenerarTokenMake,
};
