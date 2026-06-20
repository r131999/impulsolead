const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { requirePermissao } = require('../middleware/permissao.middleware');
const { getRelatorios, getRelatoriosEquipes, getRelatoriosGerente, getRelatoriosOrigem } = require('../controllers/relatorios.controller');

const router = Router();
router.use(authMiddleware);
router.use(requirePermissao('relatorios'));

router.get('/', requireRole('gestor', 'admin'), getRelatorios);
router.get('/equipes', requireRole('gestor', 'admin'), getRelatoriosEquipes);
router.get('/gerente', requireRole('gerente'), getRelatoriosGerente);
router.get('/origem', requireRole('gestor', 'admin'), getRelatoriosOrigem);

module.exports = router;
