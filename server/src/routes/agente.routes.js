const { Router } = require('express');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const { receberMensagem, processarTriagem, processarQualificacao } = require('../controllers/agente.controller');

const router = Router();

router.post('/mensagem', webhookAuthMiddleware, receberMensagem);
router.post('/triagem', webhookAuthMiddleware, processarTriagem);
router.post('/qualificacao', webhookAuthMiddleware, processarQualificacao);

module.exports = router;
