'use strict';

// ─── Embedded Signup (onboarding self-service de WhatsApp Cloud API) ───────────
// Recebe o retorno do SDK JS da Meta (código + waba_id/phone_number_id, capturados
// no frontend via FB.login + postMessage) e completa o onboarding server-to-server:
// troca o código por um token, assina nosso app na WABA do cliente e grava
// WhatsappCloudApiInstancia. Implementado só pro fluxo de Coexistência (a
// imobiliária conecta o número que já usa no app do celular, sem trocar de
// número) — por isso nunca chama /register: o número já está registrado.
//
// Endpoints autenticados por JWT de gestor (authMiddleware), diferente do restante
// de webhook.controller.js/agente.controller.js, que usam x-api-key (webhookAuthMiddleware)
// por serem chamados pelo manager Baileys/Meta, não por um usuário logado.

const prisma = require('../lib/prisma');
const { CLOUD_API_VERSION } = require('../services/whatsappCloudApi.service');

const GRAPH_BASE = `https://graph.facebook.com/${CLOUD_API_VERSION}`;

// GET /api/whatsapp-cloud-api/status — dados que a tela de conexão precisa: as
// credenciais PÚBLICAS pro SDK JS (appId/configId — não são segredo, vão pro
// browser de qualquer forma) + se já existe uma instância conectada.
async function getStatus(req, res) {
  try {
    const instancia = await prisma.whatsappCloudApiInstancia.findUnique({
      where: { imobiliariaId: req.imobiliariaId },
      select: { phoneNumberId: true, numeroExibicao: true, ativo: true },
    });

    res.json({
      appId: process.env.META_WA_APP_ID || null,
      configId: process.env.META_WA_CONFIG_ID || null,
      conectado: !!instancia?.ativo,
      phoneNumberId: instancia?.phoneNumberId || null,
      numeroExibicao: instancia?.numeroExibicao || null,
    });
  } catch (err) {
    console.error('[whatsapp-cloud-api-onboarding] getStatus:', err.message);
    res.status(500).json({ error: 'Erro ao buscar status da conexão' });
  }
}

// Troca o código de 30s de vida por um Business Integration System User (BISU)
// access token — token de longa duração, escopado à WABA que o cliente acabou de
// compartilhar. A doc da Meta não detalha o formato exato dessa troca; seguimos o
// mesmo padrão que meta.oauth.routes.js já usa pro OAuth de Lead Ads (GET
// /oauth/access_token com client_id/client_secret/code), sem redirect_uri — o
// Embedded Signup é popup client-side, não fluxo de redirect. Tratamos a resposta
// defensivamente porque não temos uma referência 100% confiável do shape exato.
async function trocarCodePorToken(code) {
  const params = new URLSearchParams({
    client_id: process.env.META_WA_APP_ID,
    client_secret: process.env.META_WA_APP_SECRET,
    code,
  });

  const resp = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const json = await resp.json().catch(() => ({}));

  if (!resp.ok || !json.access_token) {
    const motivo = json?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`Falha ao trocar code por token: ${motivo}`);
  }

  return json.access_token;
}

// Assina nosso app pros webhooks dessa WABA — sem isso a Meta nunca manda
// mensagem nenhuma pro nosso endpoint, mesmo com token e phoneNumberId válidos.
// IMPORTANTE (achado na implementação, diferente do que presumimos no plano):
// pela referência da Subscribed Apps API, esse POST não aceita parâmetro pra
// escolher campos (history/smb_app_state_sync/smb_message_echoes/messages) — os
// campos que esse app recebe são configurados uma vez, pra TODAS as WABAs, no
// painel do app (WhatsApp → Configuration → Webhook fields). Pra Coexistência
// funcionar (quando formos processar os webhooks dela, fora de escopo por ora),
// isso precisa estar marcado lá manualmente — não tem como fazer por código aqui.
async function assinarWebhooksWaba(wabaId, accessToken) {
  const resp = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await resp.json().catch(() => ({}));

  if (!resp.ok || json.success !== true) {
    const motivo = json?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`Falha ao assinar webhooks da WABA: ${motivo}`);
  }
}

// Best-effort — só pra mostrar o número na tela. Nunca deve derrubar o onboarding.
async function buscarNumeroExibicao(phoneNumberId, accessToken) {
  try {
    const resp = await fetch(
      `${GRAPH_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return null;
    return json.display_phone_number || json.verified_name || null;
  } catch {
    return null;
  }
}

// POST /api/whatsapp-cloud-api/conectar — { code, wabaId, phoneNumberId, businessId }
// businessId (Business Portfolio ID) chega do postMessage mas não é usado hoje —
// aceito e ignorado, guardamos só o necessário pra roteamento/envio.
async function conectar(req, res) {
  const { code, wabaId, phoneNumberId } = req.body;

  if (!code || !wabaId || !phoneNumberId) {
    return res.status(400).json({ error: 'Campos obrigatórios: code, wabaId, phoneNumberId' });
  }

  let accessToken;
  try {
    accessToken = await trocarCodePorToken(code);
  } catch (err) {
    console.error('[whatsapp-cloud-api-onboarding] Erro na troca de token:', err.message);
    return res.status(502).json({ error: 'Não foi possível concluir a conexão com a Meta. Tente novamente.' });
  }

  try {
    await assinarWebhooksWaba(wabaId, accessToken);
  } catch (err) {
    console.error('[whatsapp-cloud-api-onboarding] Erro ao assinar webhooks:', err.message);
    return res.status(502).json({ error: 'Conexão parcial: não foi possível assinar os webhooks. Tente novamente.' });
  }

  const numeroExibicao = await buscarNumeroExibicao(phoneNumberId, accessToken);

  try {
    await prisma.$transaction([
      prisma.whatsappCloudApiInstancia.upsert({
        where: { imobiliariaId: req.imobiliariaId },
        update: {
          phoneNumberId, businessAccountId: wabaId, accessToken, numeroExibicao, ativo: true,
        },
        create: {
          imobiliariaId: req.imobiliariaId,
          phoneNumberId, businessAccountId: wabaId, accessToken, numeroExibicao, ativo: true,
        },
      }),
      prisma.configAgente.upsert({
        where: { imobiliariaId: req.imobiliariaId },
        update: { canalWhatsapp: 'cloud_api' },
        create: { imobiliariaId: req.imobiliariaId, perguntas: [], canalWhatsapp: 'cloud_api' },
      }),
    ]);
  } catch (err) {
    console.error('[whatsapp-cloud-api-onboarding] Erro ao salvar instância:', err.message);
    return res.status(500).json({ error: 'Conectado na Meta, mas falhou ao salvar no banco. Tente novamente.' });
  }

  res.json({ ok: true, phoneNumberId, numeroExibicao });
}

module.exports = { getStatus, conectar };
