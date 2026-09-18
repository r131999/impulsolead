const { Router } = require('express');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const { receberMensagem, processarTriagem } = require('../controllers/agente.controller');

const router = Router();

router.post('/mensagem', webhookAuthMiddleware, receberMensagem);
router.post('/triagem', webhookAuthMiddleware, processarTriagem);

module.exports = router;
