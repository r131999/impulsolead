const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getConfigAgente, atualizarConfigAgente, atualizarDistribuicao, atualizarLogo } = require('../controllers/config.controller');

const router = Router();
router.use(authMiddleware);
router.use(requireRole('gestor', 'admin'));

router.get('/agente', getConfigAgente);
router.put('/agente', atualizarConfigAgente);
router.put('/distribuicao', atualizarDistribuicao);
router.put('/logo', atualizarLogo);

module.exports = router;
