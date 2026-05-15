const { Router } = require('express');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const { receberMensagem } = require('../controllers/agente.controller');

const router = Router();

router.post('/mensagem', webhookAuthMiddleware, receberMensagem);

module.exports = router;
