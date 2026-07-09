const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  verificarWebhookMeta,
  receberLeadMeta,
  statusMeta,
  conectarMeta,
  desconectarMeta,
  receberLeadMake,
  gerarTokenMake,
  regenerarTokenMake,
} = require('../controllers/integracoes.controller');

const router = Router();

// Públicas — chamadas diretamente pelo Meta
router.get('/meta/webhook', verificarWebhookMeta);
router.post('/meta/webhook', receberLeadMeta);

// Autenticadas — gerenciamento pelo gestor
router.get('/meta/status', authMiddleware, requireRole('gestor', 'admin'), statusMeta);
router.post('/meta/conectar', authMiddleware, requireRole('gestor', 'admin'), conectarMeta);
router.delete('/meta/desconectar/:pageId', authMiddleware, requireRole('gestor', 'admin'), desconectarMeta);

// Pública — chamada diretamente pelo Make (via alternativa quando a Meta falhar)
router.post('/make/webhook/:token', receberLeadMake);

// Autenticadas — gerenciamento pelo gestor
router.post('/make/gerar-token', authMiddleware, requireRole('gestor', 'admin'), gerarTokenMake);
router.post('/make/regenerar-token', authMiddleware, requireRole('gestor', 'admin'), regenerarTokenMake);

module.exports = router;
