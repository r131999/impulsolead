const crypto = require('crypto');

const CAPI_VERSION = 'v26.0';

function hash(valor) {
  if (!valor) return null;
  return crypto.createHash('sha256').update(String(valor).trim().toLowerCase()).digest('hex');
}

// Lead.telefone é salvo só com dígitos (ver normalizarTelefone em integracoes.controller.js),
// mas nem sempre com o DDI — números sem DDI têm no máximo 11 dígitos (DDD + até 9 dígitos).
// A Meta espera o `ph` com DDI, então prefixamos 55 quando ele ainda não está presente.
function telefoneComDDI(telefone) {
  if (!telefone) return null;
  const digitos = String(telefone).replace(/\D/g, '');
  if (!digitos) return null;
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

async function enviarEventoQualificacao(lead, integracao, eventName) {
  if (!integracao?.metaDatasetId || !integracao?.metaDatasetToken) return { enviado: false, motivo: 'dataset não configurado' };
  if (!lead.leadgenId) return { enviado: false, motivo: 'lead sem leadgenId' };

  const url = `https://graph.facebook.com/${CAPI_VERSION}/${integracao.metaDatasetId}/events?access_token=${integracao.metaDatasetToken}`;

  const userData = { lead_id: lead.leadgenId };
  if (lead.email) userData.em = [hash(lead.email)];
  if (lead.telefone) userData.ph = [hash(telefoneComDDI(lead.telefone))];

  const body = {
    data: [{
      action_source: 'system_generated',
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      custom_data: { event_source: 'crm', lead_event_source: 'ImpulsoLead' },
      user_data: userData,
    }],
  };

  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error?.message || `HTTP ${resp.status}`);
    console.log(`[metaCapi] Evento "${eventName}" enviado — lead ${lead.id}, recebidos: ${json.events_received}`);
    return { enviado: true };
  } catch (err) {
    console.error(`[metaCapi] Falha ao enviar evento "${eventName}" — lead ${lead.id}:`, err.message);
    return { enviado: false, motivo: err.message };
  }
}

module.exports = { enviarEventoQualificacao };
