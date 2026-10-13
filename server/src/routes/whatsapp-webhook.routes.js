const { Router } = require('express');
const { verificarAssinaturaMeta } = require('../middleware/webhook.middleware');
const { receberWebhookMensagens } = require('../controllers/whatsapp-cloud-api-webhook.controller');

const router = Router();

// GET /api/webhook/whatsapp — verificação do webhook pela Meta
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WA_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Só metadados no log — o corpo traz conteúdo de mensagens e contatos de clientes
// (dado pessoal) e nunca deve ir pro log de produção.

// Status de entrega: tipo + código/mensagem de erro da Meta (diagnóstico de falha de
// envio). Nunca recipient_id nem error_data.details.
function resumirStatus(s) {
  const erros = (Array.isArray(s?.errors) ? s.errors : [])
    .map((e) => `${e?.code ?? '?'}: ${e?.message || e?.title || 'sem mensagem'}`);
  return `${s?.status || '?'}${erros.length ? `(${erros.join('; ')})` : ''}`;
}

function resumirWebhook(body) {
  const itens = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value || {};
      const contagens = Object.entries(value)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => (k === 'statuses'
          ? `${k}=${v.length}[${v.map(resumirStatus).join(',')}]`
          : `${k}=${v.length}`))
        .join(',');
      itens.push(`${change?.field || '?'}(phone=${value.metadata?.phone_number_id || '-'}${contagens ? ` ${contagens}` : ''})`);
    }
  }
  return `object=${body?.object || '?'} ${itens.join(' ') || 'sem changes'}`;
}

// POST /api/webhook/whatsapp — recebe status de entrega (sent/delivered/read/failed) e
// mensagens recebidas (changes[].value.messages[]) da Cloud API. Endpoint público —
// verificarAssinaturaMeta confere X-Hub-Signature-256 antes de confiar no payload,
// já que mensagens agora criam lead e acionam a IA (antes só logava status).
router.post('/whatsapp', verificarAssinaturaMeta, (req, res) => {
  console.log('[whatsapp-webhook]', resumirWebhook(req.body));
  return receberWebhookMensagens(req, res);
});

module.exports = router;
