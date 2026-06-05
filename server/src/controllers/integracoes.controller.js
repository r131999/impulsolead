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
            `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,created_time,ad_name,adset_name,campaign_name,form_id&access_token=${integracao.pageToken}`
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

        const getField = (...names) => {
          for (const n of names) {
            const f = fieldData.find((x) => x.name === n);
            if (f?.values?.[0]) return f.values[0];
          }
          return null;
        };

        const nome = getField('full_name', 'nome');
        const telefone = getField('phone_number', 'telefone');
        const campanha = sanitizarTexto(leadData.campaign_name || getField('campaign_name') || value.campaign_name || null);
        const conjuntoName = sanitizarTexto(leadData.adset_name || getField('adset_name') || value.adset_name || null);
        const anuncioName = sanitizarTexto(leadData.ad_name || getField('ad_name') || value.ad_name || null);

        console.log(`[meta-webhook] Dados do lead buscados: ${nome} ${telefone}`);

        if (!nome || !telefone) continue;

        const digitos = String(telefone).replace(/\D/g, '');
        if (digitos.length < 10 || digitos.length > 15) continue;

        const nomeSanitizado = sanitizarTexto(nome);

        const configAgente = await prisma.configAgente.findUnique({
          where: { imobiliariaId },
          select: { distribuicaoManual: true },
        });
        const modoManual = configAgente?.distribuicaoManual ?? false;

        const result = await prisma.$transaction(async (tx) => {
          const lead = await tx.lead.create({
            data: {
              nome: nomeSanitizado,
              telefone: digitos,
              whatsappJid: `${digitos}@s.whatsapp.net`,
              status: 'lead',
              origem: 'Meta Ads',
              campanha: campanha || null,
              conjuntoName: conjuntoName || null,
              anuncioName: anuncioName || null,
              imobiliariaId,
            },
          });

          if (modoManual) {
            await tx.historicoLead.create({
              data: {
                leadId: lead.id,
                acao: 'Lead recebido via Meta Lead Ads — aguardando distribuição manual',
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
                acao: 'Lead recebido via Meta Lead Ads e atribuído automaticamente',
                detalhes: `Corretor: ${proximo.nome}`,
              },
            });

            await tx.historicoDistribuicao.create({
              data: {
                leadId: lead.id,
                leadNome: nomeSanitizado,
                leadTelefone: digitos,
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
                acao: 'Lead recebido via Meta Lead Ads — sem corretor disponível na fila',
              },
            });
          }

          return { lead, corretor };
        });

        console.log(`[meta-webhook] Lead criado: ${result.lead.id}`);

        if (result.corretor) {
          notificarCorretor(result.corretor, result.lead, imobiliaria).catch(() => {});
          enviarPushCorretor(
            result.corretor.id,
            '🏠 Novo lead!',
            `Nome: ${result.lead.nome} | Tel: ${result.lead.telefone}`,
          ).catch(() => {});
        }
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
    update: { pageId: pageId.trim(), pageToken: pageToken.trim(), ativo: true },
    create: { imobiliariaId: req.imobiliariaId, pageId: pageId.trim(), pageToken: pageToken.trim() },
  });

  res.json({ success: true, pageId: integracao.pageId });
}

// DELETE /api/integracoes/meta/desconectar
async function desconectarMeta(req, res) {
  await prisma.metaIntegracao.deleteMany({
    where: { imobiliariaId: req.imobiliariaId },
  });
  res.json({ success: true });
}

module.exports = { verificarWebhookMeta, receberLeadMeta, statusMeta, conectarMeta, desconectarMeta };
