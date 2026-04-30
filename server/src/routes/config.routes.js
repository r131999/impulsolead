const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { getConfigAgente, atualizarConfigAgente } = require('../controllers/config.controller');

const router = Router();
router.use(authMiddleware);

router.get('/agente', getConfigAgente);
router.put('/agente', atualizarConfigAgente);

module.exports = router;
