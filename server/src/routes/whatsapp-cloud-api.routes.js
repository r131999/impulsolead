'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getStatus, conectar } = require('../controllers/whatsapp-cloud-api-onboarding.controller');

const router = Router();

// Todas as rotas exigem autenticação de gestor — mesma exigência de whatsapp.routes.js (Baileys)
router.use(authMiddleware, requireRole('gestor'));

router.get('/status', getStatus);
router.post('/conectar', conectar);

module.exports = router;
