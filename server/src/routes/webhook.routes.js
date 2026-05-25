const { Router } = require('express');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const { receberLead, numerosBloqueados, leadAtivo, mensagemBoasVindas } = require('../controllers/webhook.controller');

const router = Router();

router.post('/lead', webhookAuthMiddleware, receberLead);
router.get('/numeros-bloqueados', webhookAuthMiddleware, numerosBloqueados);
router.get('/lead-ativo', webhookAuthMiddleware, leadAtivo);
router.get('/mensagem-boasvindas', webhookAuthMiddleware, mensagemBoasVindas);

module.exports = router;
