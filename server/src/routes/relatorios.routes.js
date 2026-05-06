const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getRelatorios } = require('../controllers/relatorios.controller');

const router = Router();
router.use(authMiddleware);
router.use(requireRole('gestor', 'admin'));

router.get('/', getRelatorios);

module.exports = router;
