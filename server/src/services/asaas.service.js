'use strict';

function baseUrl() {
  return process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';
}

function headers() {
  return {
    'Content-Type': 'application/json',
    access_token: process.env.ASAAS_API_KEY,
  };
}

// Assinatura recorrente gera um novo payment a cada ciclo — precisamos achar
// o payment PENDING atual antes de conseguir buscar o PIX dele.
async function buscarPagamentoPendente(subscriptionId) {
  const url = `${baseUrl()}/payments?subscription=${subscriptionId}&status=PENDING`;

  try {
    const resp = await fetch(url, { headers: headers() });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.errors?.[0]?.description || `HTTP ${resp.status}`);
    return json.data?.[0]?.id || null;
  } catch (err) {
    console.error(`[asaas] Falha ao buscar pagamento pendente da assinatura ${subscriptionId}:`, err.message);
    return null;
  }
}

async function buscarPixCopiaECola(paymentId) {
  const url = `${baseUrl()}/payments/${paymentId}/pixQrCode`;

  try {
    const resp = await fetch(url, { headers: headers() });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.errors?.[0]?.description || `HTTP ${resp.status}`);
    if (!json.payload) return null;
    return { payload: json.payload, expirationDate: json.expirationDate };
  } catch (err) {
    console.error(`[asaas] Falha ao buscar PIX do pagamento ${paymentId}:`, err.message);
    return null;
  }
}

module.exports = { buscarPagamentoPendente, buscarPixCopiaECola };
