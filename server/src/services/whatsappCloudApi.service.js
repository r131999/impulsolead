const CLOUD_API_VERSION = 'v21.0';

function formatarNumero(numero) {
  const digitos = numero.replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  return '55' + digitos;
}

// parametros: array (posicional, ex: [5]) OU objeto (nomeado, ex: {nome:'...', telefone:'...', origem:'...'})
function montarParametros(parametros) {
  if (Array.isArray(parametros)) {
    return parametros.map((valor) => ({ type: 'text', text: String(valor) }));
  }
  return Object.entries(parametros).map(([nome, valor]) => ({
    type: 'text',
    text: String(valor),
    parameter_name: nome,
  }));
}

async function enviarTemplate(telefone, templateName, parametros) {
  const numero = formatarNumero(telefone);
  const url = `https://graph.facebook.com/${CLOUD_API_VERSION}/${process.env.META_WA_PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to: numero,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: montarParametros(parametros) }],
    },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.META_WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error?.message || `HTTP ${resp.status}`);
    console.log(`[whatsappCloudApi] Template "${templateName}" enviado para ${numero}`);
    return { enviado: true };
  } catch (err) {
    console.error(`[whatsappCloudApi] Falha ao enviar template "${templateName}" para ${telefone}:`, err.message);
    return { enviado: false, motivo: err.message };
  }
}

module.exports = { enviarTemplate };
