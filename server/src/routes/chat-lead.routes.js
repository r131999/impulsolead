const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { requirePermissao } = require('../middleware/permissao.middleware');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const {
  listarMensagens,
  enviarMensagem,
  enviarArquivo,
  marcarLidas,
  receberMensagem,
} = require('../controllers/chat-lead.controller');
const { sugerirResposta } = require('../controllers/ia-assistente.controller');

const router = Router();

// Rota interna — autenticada por x-api-key (chamada pelo Baileys)
router.post('/:leadId/mensagem-recebida', webhookAuthMiddleware, receberMensagem);

// Rotas autenticadas por JWT
router.use(authMiddleware);
router.use(requirePermissao('chatLead'));

router.get('/:leadId/mensagens', listarMensagens);
router.post('/:leadId/mensagem', enviarMensagem);
router.post('/:leadId/mensagem-arquivo', enviarArquivo);
router.put('/:leadId/marcar-lidas', marcarLidas);
router.post('/:leadId/sugerir-resposta', sugerirResposta);

module.exports = router;
