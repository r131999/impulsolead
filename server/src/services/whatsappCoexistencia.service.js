'use strict';

// ─── Coexistência (WhatsApp Business app + Cloud API no mesmo número) ──────────
// Etapas pós-onboarding que a Meta só aceita UMA vez cada e em até 24h do
// onboarding (refazer exige offboarding + novo Embedded Signup):
//   1. contatos  → POST /{phone_number_id}/smb_app_data { sync_type: 'smb_app_state_sync' }
//   2. histórico → POST /{phone_number_id}/smb_app_data { sync_type: 'history' }
// Os dados chegam depois, por webhook, nos campos smb_app_state_sync e history —
// por isso os campos precisam estar assinados no app ANTES do disparo, senão a
// única chance de sincronizar é desperdiçada.
// Ref: developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users
//
// Nunca é chamado automaticamente — só pelo script scripts/coexistencia-sync.js.

const prisma = require('../lib/prisma');
const { CLOUD_API_VERSION } = require('./whatsappCloudApi.service');

const GRAPH_BASE = `https://graph.facebook.com/${CLOUD_API_VERSION}`;
const LOG = '[whatsapp-coexistencia]';
const JANELA_MS = 24 * 60 * 60 * 1000;
const CAMPOS_COEXISTENCIA = ['history', 'smb_app_state_sync', 'smb_message_echoes'];

const TIPOS = {
  contatos:  { syncType: 'smb_app_state_sync', campoId: 'syncContatosRequestId',  campoEm: 'syncContatosEm' },
  historico: { syncType: 'history',            campoId: 'syncHistoricoRequestId', campoEm: 'syncHistoricoEm' },
};

// Campos de webhook são do app (painel → WhatsApp → Configuration), não da WABA.
// Só LEITURA aqui: GET /{app-id}/subscriptions com app token. Alterar a assinatura
// por API mexeria no webhook que já está em produção — isso fica no painel.
async function verificarCamposWebhook() {
  const appId = process.env.META_WA_APP_ID;
  const appToken = `${appId}|${process.env.META_WA_APP_SECRET}`;
  const resp = await fetch(`${GRAPH_BASE}/${appId}/subscriptions`, {
    headers: { Authorization: `Bearer ${appToken}` },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Falha ao ler assinaturas do app: ${json?.error?.message || `HTTP ${resp.status}`}`);
  }

  const assinatura = (json.data || []).find((s) => s.object === 'whatsapp_business_account');
  const assinados = (assinatura?.fields || []).map((f) => (typeof f === 'string' ? f : f.name));
  return {
    callbackUrl: assinatura?.callback_url || null,
    assinados,
    faltando: CAMPOS_COEXISTENCIA.filter((c) => !assinados.includes(c)),
  };
}

function statusInstancia(instancia) {
  const inicio = instancia.coexistenciaOnboardingEm;
  const restanteMs = inicio ? inicio.getTime() + JANELA_MS - Date.now() : null;
  return {
    onboardingEm: inicio,
    janelaAberta: restanteMs !== null && restanteMs > 0,
    restanteMin: restanteMs !== null ? Math.max(0, Math.floor(restanteMs / 60000)) : null,
    contatos:  instancia.syncContatosEm  ? { em: instancia.syncContatosEm,  requestId: instancia.syncContatosRequestId }  : null,
    historico: instancia.syncHistoricoEm ? { em: instancia.syncHistoricoEm, requestId: instancia.syncHistoricoRequestId } : null,
  };
}

// Dispara UMA sync. Valida tudo que dá pra validar antes, porque não tem retry.
async function dispararSync(imobiliariaId, tipo) {
  const cfg = TIPOS[tipo];
  if (!cfg) throw new Error(`Tipo inválido: ${tipo} (use contatos | historico)`);

  const instancia = await prisma.whatsappCloudApiInstancia.findUnique({ where: { imobiliariaId } });
  if (!instancia || !instancia.ativo) throw new Error('Imobiliária sem instância Cloud API ativa');

  const status = statusInstancia(instancia);
  if (!status.onboardingEm) throw new Error('Instância sem data de onboarding (não passou pelo Embedded Signup)');
  if (!status.janelaAberta) throw new Error('Janela de 24h encerrada — o cliente precisa refazer o onboarding');
  if (instancia[cfg.campoEm]) {
    throw new Error(`Sync de ${tipo} já disparada em ${instancia[cfg.campoEm].toISOString()} (request_id=${instancia[cfg.campoId]})`);
  }
  if (tipo === 'historico' && !instancia.syncContatosEm) {
    throw new Error('A Meta exige sincronizar contatos antes do histórico');
  }

  const campos = await verificarCamposWebhook();
  if (campos.faltando.length) {
    throw new Error(`Campos de webhook não assinados no app: ${campos.faltando.join(', ')} — marque no painel antes`);
  }

  console.log(`${LOG} disparando ${tipo} imob=${imobiliariaId} phone=${instancia.phoneNumberId}`);
  const resp = await fetch(`${GRAPH_BASE}/${instancia.phoneNumberId}/smb_app_data`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instancia.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: cfg.syncType }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.request_id) {
    const motivo = json?.error?.message || `HTTP ${resp.status}`;
    console.error(`${LOG} falha ${tipo} imob=${imobiliariaId}: ${motivo}`, JSON.stringify(json?.error || {}));
    throw new Error(`Meta recusou a sync de ${tipo}: ${motivo}`);
  }

  await prisma.whatsappCloudApiInstancia.update({
    where: { id: instancia.id },
    data: { [cfg.campoId]: json.request_id, [cfg.campoEm]: new Date() },
  });
  console.log(`${LOG} ${tipo} aceita imob=${imobiliariaId} request_id=${json.request_id}`);
  return json.request_id;
}

module.exports = { verificarCamposWebhook, statusInstancia, dispararSync, CAMPOS_COEXISTENCIA };
