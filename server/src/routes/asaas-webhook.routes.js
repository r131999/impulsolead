const { Router } = require('express');
const { receberWebhookAsaas } = require('../controllers/asaas-webhook.controller');

const router = Router();

// POST /api/webhook/asaas — eventos de pagamento (PAYMENT_RECEIVED / PAYMENT_CONFIRMED)
router.post('/asaas', receberWebhookAsaas);

module.exports = router;
