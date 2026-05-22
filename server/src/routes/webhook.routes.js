const { Router } = require('express');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const { receberLead, numerosBloqueados, leadAtivo } = require('../controllers/webhook.controller');

const router = Router();

router.post('/lead', webhookAuthMiddleware, receberLead);
router.get('/numeros-bloqueados', webhookAuthMiddleware, numerosBloqueados);
router.get('/lead-ativo', webhookAuthMiddleware, leadAtivo);

module.exports = router;
