const https = require('https');
const http = require('http');

// Formata número para o padrão Evolution API: 55XXXXXXXXXXX (só dígitos, com DDI)
function formatarNumero(numero) {
  const digitos = numero.replace(/\D/g, '');
  // Se já tem DDI (11 dígitos com 55) ou mais, usa como está
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  // Senão, prepend 55
  return '55' + digitos;
}

function montarMensagem(corretor, lead) {
  const campo = (label, valor) => valor ? `• *${label}:* ${valor}\n` : '';

  return (
    `🏠 *Novo lead atribuído para você!*\n\n` +
    `*Nome:* ${lead.nome}\n` +
    `*Telefone:* ${lead.telefone}\n` +
    (lead.urgencia ? `*Urgência:* ${lead.urgencia}\n` : '') +
    `\n*Perfil financeiro:*\n` +
    campo('Primeiro imóvel', lead.primeiroImovel) +
    campo('Tipo de renda', lead.tipoRenda) +
    campo('Renda mensal', lead.rendaMensal) +
    campo('Restrição CPF', lead.restricaoCpf) +
    campo('Valor de entrada', lead.valorEntrada) +
    `\n*Imóvel desejado:*\n` +
    campo('Região', lead.regiao) +
    campo('Faixa de valor', lead.faixaValor) +
    `\n_Acesse o CRM para ver mais detalhes._`
  );
}

async function notificarViaEvolution(corretor, lead) {
  const apiUrl      = process.env.EVOLUTION_API_URL;
  const apiKey      = process.env.EVOLUTION_API_KEY;
  const instancia   = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instancia) {
    return { enviado: false, motivo: 'Evolution API não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY ou EVOLUTION_INSTANCE_NAME ausente)' };
  }

  const numero = formatarNumero(corretor.whatsapp || corretor.telefone);
  const texto  = montarMensagem(corretor, lead);
  const url    = `${apiUrl}/message/sendText/${instancia}`;

  const body = JSON.stringify({ number: numero, text: texto });

  await httpPost(url, body, { apikey: apiKey });
  console.log(`[notificacao] WhatsApp enviado para ${corretor.nome} (${numero})`);
  return { enviado: true };
}

async function notificarViaWebhook(corretor, lead, imobiliaria) {
  const webhookUrl = process.env.NOTIFICACAO_WEBHOOK_URL;

  if (!webhookUrl) {
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
      restricaoCpf: lead.restricaoCpf,
      valorEntrada: lead.valorEntrada,
      urgencia: lead.urgencia,
      regiao: lead.regiao,
      faixaValor: lead.faixaValor,
    },
    corretor: { id: corretor.id, nome: corretor.nome, whatsapp: corretor.whatsapp, telefone: corretor.telefone },
    imobiliaria: { id: imobiliaria.id, nome: imobiliaria.nome },
    timestamp: new Date().toISOString(),
  });

  await httpPost(webhookUrl, payload, {});
  console.log(`[notificacao] Webhook enviado para ${corretor.nome} (${corretor.whatsapp})`);
  return { enviado: true };
}

// Ponto de entrada principal — tenta Evolution API, faz fallback para webhook genérico.
// Não bloqueia o fluxo principal: falhas são logadas, não propagadas.
async function notificarCorretor(corretor, lead, imobiliaria) {
  try {
    const resultado = await notificarViaEvolution(corretor, lead);
    if (resultado.enviado) return resultado;

    // Se Evolution não está configurada, tenta o webhook genérico
    console.log(`[notificacao] ${resultado.motivo} — tentando webhook genérico.`);
    return await notificarViaWebhook(corretor, lead, imobiliaria);
  } catch (err) {
    console.error(`[notificacao] Falha ao notificar ${corretor.nome}:`, err.message);
    return { enviado: false, motivo: err.message };
  }
}

async function notificarGestorPendencia(telefoneGestor, nomeCorretor) {
  const apiUrl    = process.env.EVOLUTION_API_URL;
  const apiKey    = process.env.EVOLUTION_API_KEY;
  const instancia = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instancia) {
    console.log('[notificacao] Evolution API não configurada — notificação de pendência ignorada');
    return { enviado: false };
  }

  const numero = formatarNumero(telefoneGestor);
  const texto  = `⚠️ *${nomeCorretor}* foi pulado na fila.\nMotivo: lead parado há mais de 24h sem observação.`;
  const url    = `${apiUrl}/message/sendText/${instancia}`;
  const body   = JSON.stringify({ number: numero, text: texto });

  try {
    await httpPost(url, body, { apikey: apiKey });
    console.log(`[notificacao] Pendência notificada ao gestor sobre ${nomeCorretor}`);
    return { enviado: true };
  } catch (err) {
    console.error('[notificacao] Falha ao notificar gestor sobre pendência:', err.message);
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
async function enviarWhatsApp(telefone, texto) {
  const apiUrl    = process.env.EVOLUTION_API_URL;
  const apiKey    = process.env.EVOLUTION_API_KEY;
  const instancia = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instancia) {
    console.log('[notificacao] Evolution API não configurada — mensagem ignorada');
    return { enviado: false };
  }

  const numero = formatarNumero(telefone);
  const url    = `${apiUrl}/message/sendText/${instancia}`;
  const body   = JSON.stringify({ number: numero, text: texto });

  try {
    await httpPost(url, body, { apikey: apiKey });
    console.log(`[notificacao] WhatsApp enviado para ${numero}`);
    return { enviado: true };
  } catch (err) {
    console.error('[notificacao] Falha ao enviar WhatsApp:', err.message);
    return { enviado: false };
  }
}

module.exports = { notificarCorretor, notificarGestorPendencia, enviarWhatsApp };
