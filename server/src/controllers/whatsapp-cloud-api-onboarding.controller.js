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

const LOG = '[whatsapp-cloud-api-onboarding]';

// Troca o código de 30s de vida por um business token (Business Integration
// System User), escopado à WABA que o cliente acabou de compartilhar.
// GET /oauth/access_token?client_id&client_secret&code, sem redirect_uri — o
// Embedded Signup é popup client-side. client_id = META_WA_APP_ID (2197265537720344
// em produção). A doc diz que a resposta vem "como texto"; na prática é JSON
// { access_token, token_type } — aceitamos os dois formatos.
async function trocarCodePorToken(code) {
  const params = new URLSearchParams({
    client_id: process.env.META_WA_APP_ID,
    client_secret: process.env.META_WA_APP_SECRET,
    code,
  });

  const resp = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const texto = await resp.text().catch(() => '');
  let json = {};
  try { json = JSON.parse(texto); } catch { /* texto puro */ }

  const accessToken = json.access_token || (!texto.trim().startsWith('{') ? texto.trim() : null);
  if (!resp.ok || !accessToken) {
    const motivo = json?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`Falha ao trocar code por token: ${motivo}`);
  }

  return accessToken;
}

// No fluxo de Coexistência o evento FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING pode
// trazer só waba_id (a doc de Coexistência lista apenas esse campo). Sem
// phone_number_id, buscamos os números da WABA — na Coexistência é um só.
async function resolverPhoneNumberId(wabaId, accessToken) {
  const resp = await fetch(
    `${GRAPH_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Falha ao listar números da WABA: ${json?.error?.message || `HTTP ${resp.status}`}`);
  }
  const numeros = Array.isArray(json.data) ? json.data : [];
  if (numeros.length !== 1) {
    throw new Error(`WABA ${wabaId} tem ${numeros.length} números — não dá pra escolher sem phone_number_id`);
  }
  return numeros[0].id;
}

// Assina nosso app pros webhooks dessa WABA — sem isso a Meta nunca manda
// mensagem nenhuma pro nosso endpoint, mesmo com token e phoneNumberId válidos.
// Esse POST não escolhe campos: os campos (messages, history, smb_app_state_sync,
// smb_message_echoes) são do app, configurados no painel (WhatsApp → Configuration
// → Webhook fields) e valem pra todas as WABAs. A conferência deles fica em
// services/whatsappCoexistencia.service.js (verificarCamposWebhook).
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

// Best-effort — número pra tela + is_on_biz_app/platform_type só pra log (na
// Coexistência a Meta espera is_on_biz_app=true e platform_type=CLOUD_API).
// Nunca deve derrubar o onboarding.
async function buscarDadosNumero(phoneNumberId, accessToken) {
  try {
    const resp = await fetch(
      `${GRAPH_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return {};
    return json;
  } catch {
    return {};
  }
}

// POST /api/whatsapp-cloud-api/conectar — { code, wabaId, phoneNumberId?, businessId? }
// businessId (Business Portfolio ID) chega do postMessage mas não é usado hoje.
// Logs nunca incluem code nem token.
async function conectar(req, res) {
  const { code, wabaId } = req.body;
  let { phoneNumberId } = req.body;
  const imobiliariaId = req.imobiliariaId;
  const ctx = `imob=${imobiliariaId} waba=${wabaId} phone=${phoneNumberId || '(não veio)'}`;

  console.log(`${LOG} [0/4] início ${ctx}`);

  if (!code || !wabaId) {
    console.warn(`${LOG} [0/4] payload incompleto ${ctx} code=${code ? 'ok' : 'ausente'}`);
    return res.status(400).json({ error: 'Campos obrigatórios: code, wabaId' });
  }
  if (!process.env.META_WA_APP_ID || !process.env.META_WA_APP_SECRET) {
    console.error(`${LOG} [0/4] META_WA_APP_ID/META_WA_APP_SECRET não configurados`);
    return res.status(500).json({ error: 'Conexão via Meta não configurada no servidor.' });
  }

  // 1. code → business token
  let accessToken;
  try {
    accessToken = await trocarCodePorToken(code);
    console.log(`${LOG} [1/4] token obtido ${ctx}`);
  } catch (err) {
    console.error(`${LOG} [1/4] erro na troca de token ${ctx}:`, err.message);
    return res.status(502).json({ error: 'Não foi possível concluir a conexão com a Meta. Tente novamente.' });
  }

  if (!phoneNumberId) {
    try {
      phoneNumberId = await resolverPhoneNumberId(wabaId, accessToken);
      console.log(`${LOG} [1/4] phone_number_id resolvido pela WABA: ${phoneNumberId}`);
    } catch (err) {
      console.error(`${LOG} [1/4] ${err.message}`);
      return res.status(502).json({ error: 'Não foi possível identificar o número conectado. Tente novamente.' });
    }
  }

  // 2. Inscreve o app na WABA
  try {
    await assinarWebhooksWaba(wabaId, accessToken);
    console.log(`${LOG} [2/4] app inscrito na WABA ${wabaId}`);
  } catch (err) {
    console.error(`${LOG} [2/4] erro ao inscrever app na WABA ${wabaId}:`, err.message);
    return res.status(502).json({ error: 'Conexão parcial: não foi possível assinar os webhooks. Tente novamente.' });
  }

  const dadosNumero = await buscarDadosNumero(phoneNumberId, accessToken);
  const numeroExibicao = dadosNumero.display_phone_number || dadosNumero.verified_name || null;
  console.log(
    `${LOG} [2/4] número ${phoneNumberId}: exibição=${numeroExibicao} ` +
    `is_on_biz_app=${dadosNumero.is_on_biz_app} platform_type=${dadosNumero.platform_type}`,
  );

  // 3. Grava a instância (upsert pela chave única phoneNumberId)
  try {
    const donoAtual = await prisma.whatsappCloudApiInstancia.findUnique({
      where: { phoneNumberId },
      select: { imobiliariaId: true },
    });
    if (donoAtual && donoAtual.imobiliariaId !== imobiliariaId) {
      console.error(`${LOG} [3/4] phone ${phoneNumberId} já vinculado a outra imobiliária (${donoAtual.imobiliariaId})`);
      return res.status(409).json({ error: 'Este número já está conectado a outra conta. Fale com o suporte.' });
    }

    // Novo onboarding reabre a janela de 24h da Coexistência; quem decide se a sync
    // ainda é permitida é a Meta (refazer o fluxo após offboarding libera de novo).
    const dados = {
      businessAccountId: wabaId, accessToken, numeroExibicao, ativo: true,
      coexistenciaOnboardingEm: new Date(),
      syncContatosRequestId: null, syncContatosEm: null,
      syncHistoricoRequestId: null, syncHistoricoEm: null,
    };
    await prisma.$transaction([
      // imobiliariaId também é @unique: se a imobiliária está trocando de número,
      // a linha antiga (outro phoneNumberId) precisa sair antes do upsert criar a nova.
      prisma.whatsappCloudApiInstancia.deleteMany({
        where: { imobiliariaId, phoneNumberId: { not: phoneNumberId } },
      }),
      prisma.whatsappCloudApiInstancia.upsert({
        where: { phoneNumberId },
        update: dados,
        create: { imobiliariaId, phoneNumberId, ...dados },
      }),
    ]);
    console.log(`${LOG} [3/4] instância gravada imob=${imobiliariaId} phone=${phoneNumberId}`);
  } catch (err) {
    console.error(`${LOG} [3/4] erro ao salvar instância ${ctx}:`, err.message);
    return res.status(500).json({ error: 'Conectado na Meta, mas falhou ao salvar no banco. Tente novamente.' });
  }

  // 4. Ativa o canal Cloud API pra imobiliária
  try {
    await prisma.configAgente.upsert({
      where: { imobiliariaId },
      update: { canalWhatsapp: 'cloud_api' },
      create: { imobiliariaId, perguntas: [], canalWhatsapp: 'cloud_api' },
    });
    console.log(`${LOG} [4/4] canalWhatsapp=cloud_api imob=${imobiliariaId} — onboarding concluído`);
  } catch (err) {
    console.error(`${LOG} [4/4] erro ao ativar canal imob=${imobiliariaId}:`, err.message);
    return res.status(500).json({ error: 'Número conectado, mas falhou ao ativar o canal. Tente novamente.' });
  }

  res.json({ ok: true, phoneNumberId, numeroExibicao });
}

module.exports = { getStatus, conectar };
