const https = require('https');
const http = require('http');

// Envia notificação ao corretor via webhook configurado (N8N ou Evolution API).
// Não bloqueia o fluxo principal — falhas são logadas, não propagadas.
async function notificarCorretor(corretor, lead, imobiliaria) {
  const webhookUrl = process.env.NOTIFICACAO_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`[notificacao] Webhook não configurado. Lead ${lead.id} atribuído a ${corretor.nome}.`);
    return { enviado: false, motivo: 'NOTIFICACAO_WEBHOOK_URL não configurada' };
  }

  const payload = JSON.stringify({
    evento: 'lead_atribuido',
    lead: {
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      whatsappJid: lead.whatsappJid,
      status: lead.status,
      primeiroImovel: lead.primeiroImovel,
      tipoRenda: lead.tipoRenda,
      rendaMensal: lead.rendaMensal,
      urgencia: lead.urgencia,
      regiao: lead.regiao,
      faixaValor: lead.faixaValor,
    },
    corretor: {
      id: corretor.id,
      nome: corretor.nome,
      whatsapp: corretor.whatsapp,
      telefone: corretor.telefone,
    },
    imobiliaria: {
      id: imobiliaria.id,
      nome: imobiliaria.nome,
    },
    timestamp: new Date().toISOString(),
  });

  try {
    await httpPost(webhookUrl, payload);
    console.log(`[notificacao] Notificação enviada para ${corretor.nome} (${corretor.whatsapp})`);
    return { enviado: true };
  } catch (err) {
    console.error(`[notificacao] Falha ao notificar ${corretor.nome}:`, err.message);
    return { enviado: false, motivo: err.message };
  }
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 5000,
    };

    const req = lib.request(options, (res) => {
      res.resume();
      resolve({ status: res.statusCode });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout ao notificar')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { notificarCorretor };
