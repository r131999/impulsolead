const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getDashboard, getDashboardCorretor } = require('../controllers/dashboard.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', requireRole('gestor', 'admin'), getDashboard);
router.get('/corretor', requireRole('corretor'), getDashboardCorretor);

module.exports = router;
