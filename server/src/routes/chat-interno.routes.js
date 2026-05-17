const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const {
  listarConversas,
  listarMensagens,
  criarOuBuscarConversa,
  enviarMensagem,
  marcarLidas,
  naoLidasTotal,
  listarParticipantes,
} = require('../controllers/chat-interno.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/participantes', listarParticipantes);
router.get('/nao-lidas', naoLidasTotal);
router.get('/conversas', listarConversas);
router.post('/conversas', criarOuBuscarConversa);
router.get('/conversas/:conversaId/mensagens', listarMensagens);
router.post('/conversas/:conversaId/mensagens', enviarMensagem);
router.put('/conversas/:conversaId/lidas', marcarLidas);

module.exports = router;
