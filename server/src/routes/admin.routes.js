const { Router } = require('express');
const { listarClientes, atualizarPlano, criarCliente, getStats } = require('../controllers/admin.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = Router();

router.use(authMiddleware, requireRole('supremo'));

router.get('/clientes', listarClientes);
router.post('/clientes', criarCliente);
router.put('/clientes/:id/plano', atualizarPlano);
router.get('/stats', getStats);

module.exports = router;
