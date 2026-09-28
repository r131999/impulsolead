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

// POST /api/webhook/whatsapp — recebe status de entrega (sent/delivered/read/failed) e
// mensagens recebidas (changes[].value.messages[]) da Cloud API. Endpoint público —
// verificarAssinaturaMeta confere X-Hub-Signature-256 antes de confiar no payload,
// já que mensagens agora criam lead e acionam a IA (antes só logava status).
router.post('/whatsapp', verificarAssinaturaMeta, (req, res) => {
  console.log('[whatsapp-webhook]', JSON.stringify(req.body));
  return receberWebhookMensagens(req, res);
});

module.exports = router;
