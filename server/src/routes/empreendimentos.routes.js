const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { criar, listar, editar, excluir } = require('../controllers/empreendimentos.controller');

const router = Router();
router.use(authMiddleware);

router.get('/',     requireRole('gestor', 'admin', 'gerente', 'corretor'), listar);
router.post('/',    requireRole('gestor', 'admin', 'gerente'),             criar);
router.put('/:id',  requireRole('gestor', 'admin', 'gerente'),             editar);
router.delete('/:id', requireRole('gestor', 'admin', 'gerente'),           excluir);

module.exports = router;
