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
    return { enviado: true, whatsappMsgId: json.messages?.[0]?.id };
  } catch (err) {
    console.error(`[whatsappCloudApi] Falha ao enviar template "${templateName}" para ${telefone}:`, err.message);
    return { enviado: false, motivo: err.message };
  }
}

// ─── Envio por imobiliária (WhatsappCloudApiInstancia) ────────────────────────
// Diferente de enviarTemplate acima (WABA global do ImpulsoLead, usado só pra
// notificar corretor/gestor), estas funções falam com o WABA DA IMOBILIÁRIA —
// por isso recebem phoneNumberId/accessToken como parâmetro em vez de ler de env.

// Texto livre — só é aceito pela Cloud API dentro da janela de 24h após a última
// mensagem do lead (é sempre o caso aqui: quem inicia a conversa é o lead).
async function enviarTextoLivre(telefone, texto, { phoneNumberId, accessToken }) {
  const numero = formatarNumero(telefone);
  const url = `https://graph.facebook.com/${CLOUD_API_VERSION}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to: numero,
    type: 'text',
    text: { body: texto },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok) throw erroMeta(json, resp.status);
    return { enviado: true, whatsappMsgId: json.messages?.[0]?.id };
  } catch (err) {
    console.error(`[whatsappCloudApi] Falha ao enviar texto livre para ${telefone}:`, err.message);
    return { enviado: false, motivo: err.message, codigo: err.codigo ?? null };
  }
}

// Erro da Graph API com o código numérico preservado (ex: 131047 = fora da janela
// de 24h) — quem chama decide a mensagem pro usuário a partir dele.
function erroMeta(json, status) {
  const err = new Error(json?.error?.message || `HTTP ${status}`);
  err.codigo = json?.error?.code ?? null;
  return err;
}

const TIPO_MIDIA_CLOUD_API = { imagem: 'image', video: 'video', pdf: 'document' };

// Mídia por link público (a Meta baixa a URL) — mesma regra de janela de 24h do texto livre.
async function enviarMidiaLink(telefone, { tipoMidia, url, caption, filename }, { phoneNumberId, accessToken }) {
  const numero = formatarNumero(telefone);
  const tipo = TIPO_MIDIA_CLOUD_API[tipoMidia] || 'document';
  const midia = { link: url };
  if (caption) midia.caption = caption;
  if (tipo === 'document' && filename) midia.filename = filename;

  try {
    const resp = await fetch(`https://graph.facebook.com/${CLOUD_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: numero, type: tipo, [tipo]: midia }),
    });
    const json = await resp.json();
    if (!resp.ok) throw erroMeta(json, resp.status);
    return { enviado: true, whatsappMsgId: json.messages?.[0]?.id };
  } catch (err) {
    console.error(`[whatsappCloudApi] Falha ao enviar mídia (${tipo}) para ${telefone}:`, err.message);
    return { enviado: false, motivo: err.message, codigo: err.codigo ?? null };
  }
}

// Marca a mensagem recebida como lida e pede o indicador "digitando..." — equivalente
// da Cloud API pro sendPresenceUpdate('composing') do Baileys. Fica visível por até
// ~25s ou até a próxima mensagem ser enviada, o que cobre com folga o teto de delay
// que já usamos (DELAY_DIGITACAO_MAX_MS = 9s). Falha aqui nunca deve impedir o envio
// da mensagem real — quem chama trata o delay como válido de qualquer forma.
async function marcarLidoComDigitando(msgId, { phoneNumberId, accessToken }) {
  const url = `https://graph.facebook.com/${CLOUD_API_VERSION}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: msgId,
    typing_indicator: { type: 'text' },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}));
      throw new Error(json?.error?.message || `HTTP ${resp.status}`);
    }
    return { enviado: true };
  } catch (err) {
    console.warn(`[whatsappCloudApi] Falha ao marcar lido/digitando (${msgId}):`, err.message);
    return { enviado: false, motivo: err.message };
  }
}

module.exports = { enviarTemplate, enviarTextoLivre, enviarMidiaLink, marcarLidoComDigitando, CLOUD_API_VERSION };
