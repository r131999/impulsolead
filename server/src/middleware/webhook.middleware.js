
const crypto = require('crypto');
const prisma = require('../lib/prisma');

async function webhookAuthMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'x-api-key header obrigatório' });
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({
    where: { apiKey },
    select: { id: true, nome: true, plano: true, trialExpiraEm: true },
  });

  if (!imobiliaria) {
    const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
    console.warn(`[webhook] x-api-key inválida | IP: ${ip} | key: ${apiKey.slice(0, 8)}...`);
    return res.status(401).json({ error: 'API key inválida' });
  }

  // Entrada de lead via WhatsApp/N8N nunca para por vencimento de trial/plano —
  // só a auth por x-api-key é checada aqui.
  req.imobiliariaId = imobiliaria.id;
  req.imobiliaria = imobiliaria;
  next();
}

// Valida X-Hub-Signature-256 dos webhooks da Meta (WhatsApp Cloud API) — o payload
// vem de um endpoint público que agora cria lead e aciona a IA (antes só logava
// status de entrega), então precisa provar que veio da Meta e não foi forjado.
// Assinatura é HMAC-SHA256 do corpo bruto da requisição com o App Secret do app
// Meta que detém a inscrição do webhook (um único app do ImpulsoLead — não depende
// de qual imobiliária/WABA está mandando, o app é sempre o mesmo).
// Requer app.js capturando req.rawBody no verify do express.json().
function verificarAssinaturaMeta(req, res, next) {
  const appSecret = process.env.META_WA_APP_SECRET;
  if (!appSecret) {
    console.warn('[webhook] META_WA_APP_SECRET não configurado — assinatura do webhook Meta não verificada');
    return next();
  }

  const assinatura = req.headers['x-hub-signature-256'];
  if (!assinatura || !req.rawBody) {
    return res.status(401).json({ error: 'Assinatura ausente' });
  }

  const esperada = `sha256=${crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex')}`;

  const bufRecebida = Buffer.from(assinatura);
  const bufEsperada = Buffer.from(esperada);
  const valida = bufRecebida.length === bufEsperada.length && crypto.timingSafeEqual(bufRecebida, bufEsperada);

  if (!valida) {
    console.warn('[webhook] Assinatura Meta inválida — requisição rejeitada');
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  next();
}

module.exports = { webhookAuthMiddleware, verificarAssinaturaMeta };
