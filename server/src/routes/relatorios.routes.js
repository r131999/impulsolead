const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getRelatorios, getRelatoriosEquipes, getRelatoriosGerente } = require('../controllers/relatorios.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', requireRole('gestor', 'admin'), getRelatorios);
router.get('/equipes', requireRole('gestor', 'admin'), getRelatoriosEquipes);
router.get('/gerente', requireRole('gerente'), getRelatoriosGerente);

module.exports = router;
