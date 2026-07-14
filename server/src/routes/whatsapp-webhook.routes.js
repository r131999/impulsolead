const { Router } = require('express');

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

// POST /api/webhook/whatsapp — recebe status/eventos de mensagem (sent/delivered/read/failed)
router.post('/whatsapp', (req, res) => {
  res.sendStatus(200); // responde rápido, sempre, antes de processar
  console.log('[whatsapp-webhook]', JSON.stringify(req.body));
});

module.exports = router;
