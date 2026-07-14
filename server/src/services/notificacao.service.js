const https = require('https');
const http = require('http');
const { enviarTemplate } = require('./whatsappCloudApi.service');

// Formata número para o padrão Evolution API: 55XXXXXXXXXXX (só dígitos, com DDI)
function formatarNumero(numero) {
  const digitos = numero.replace(/\D/g, '');
  // Se já tem DDI (11 dígitos com 55) ou mais, usa como está
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  // Senão, prepend 55
  return '55' + digitos;
}

function resolverOrigemLead(lead) {
  return lead.campanha || 'Contato direto';
}

async function notificarCorretorCloudApi(corretor, lead) {
  const numero = corretor.whatsapp || corretor.telefone;
  return enviarTemplate(numero, 'novo_lead_atribuido', {
    nome: lead.nome,
    telefone: lead.telefone,
    origem: resolverOrigemLead(lead),
  });
}

async function notificarGestorPendencia(telefoneGestor, nomeCorretor, imobiliariaId) {
  const numero = formatarNumero(telefoneGestor);
  try {
    await enviarTemplate(numero, 'pendencia_corretor_pulado', { nome_corretor: nomeCorretor });
    console.log(`[notificacao] Pendência notificada ao gestor sobre ${nomeCorretor}`);
    return { enviado: true };
  } catch (err) {
    console.error('[notificacao] Falha ao notificar gestor sobre pendência via Cloud API:', err.message);
    return { enviado: false };
  }
}

function httpPost(url, body, extraHeaders = {}) {
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
        ...extraHeaders,
      },
      timeout: 8000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout ao notificar')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Envio genérico — usado pelos cron jobs
async function enviarWhatsApp(telefone, texto, imobiliariaId) {
  const numero = formatarNumero(telefone);
  // Usa a instância global de notificações (conectada).
  // As instâncias por imobiliária não estão conectadas no Baileys.
  const instanciaId = process.env.NOTIF_INSTANCE_ID || imobiliariaId;
  const body   = JSON.stringify({ imobiliariaId: instanciaId, number: numero, text: texto });

  try {
    await httpPost('http://impulsolead-whatsapp:3010/send', body, {});
    console.log(`[notificacao] WhatsApp enviado para ${numero}`);
    return { enviado: true };
  } catch (err) {
    console.error('[notificacao] Falha ao enviar WhatsApp via Baileys:', err.message);
    return { enviado: false };
  }
}

module.exports = { notificarGestorPendencia, enviarWhatsApp, notificarCorretorCloudApi };
