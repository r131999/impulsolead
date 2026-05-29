const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  verificarWebhookMeta,
  receberLeadMeta,
  statusMeta,
  conectarMeta,
  desconectarMeta,
} = require('../controllers/integracoes.controller');

const router = Router();

// Públicas — chamadas diretamente pelo Meta
router.get('/meta/webhook', verificarWebhookMeta);
router.post('/meta/webhook', receberLeadMeta);

// Autenticadas — gerenciamento pelo gestor
router.get('/meta/status', authMiddleware, requireRole('gestor', 'admin'), statusMeta);
router.post('/meta/conectar', authMiddleware, requireRole('gestor', 'admin'), conectarMeta);
router.delete('/meta/desconectar', authMiddleware, requireRole('gestor', 'admin'), desconectarMeta);

module.exports = router;
