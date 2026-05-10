const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getDashboard, getDashboardCorretor, getDashboardGerente, getFunil } = require('../controllers/dashboard.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', requireRole('gestor', 'admin'), getDashboard);
router.get('/funil', requireRole('gestor', 'admin'), getFunil);
router.get('/corretor', requireRole('corretor'), getDashboardCorretor);
router.get('/gerente', requireRole('gerente'), getDashboardGerente);

module.exports = router;
