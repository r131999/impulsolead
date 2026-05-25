'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  getStatus,
  conectar,
  deletarSessao,
} = require('../controllers/whatsapp.controller');

const router = Router();

// Todas as rotas exigem autenticação de gestor
router.use(authMiddleware, requireRole('gestor'));

router.get('/status', getStatus);
router.post('/connect', conectar);
router.delete('/session', deletarSessao);

module.exports = router;
