const { Router } = require('express');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const { receberLead, numerosBloqueados } = require('../controllers/webhook.controller');

const router = Router();

router.post('/lead', webhookAuthMiddleware, receberLead);
router.get('/numeros-bloqueados', webhookAuthMiddleware, numerosBloqueados);

module.exports = router;
