const { Router } = require('express');
const {
  listarClientes, atualizarPlano, atualizarPermissoes, atualizarLimiteAcessos,
  atualizarAdAccount, getPlanoCliente, criarCliente, getStats,
} = require('../controllers/admin.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  getAllStatus,
  adminConectar,
  adminGetStatus,
  adminDeletarSessao,
} = require('../controllers/whatsapp.controller');

const router = Router();

router.use(authMiddleware, requireRole('supremo'));

router.get('/clientes', listarClientes);
router.post('/clientes', criarCliente);
router.put('/clientes/:id/plano', atualizarPlano);
router.patch('/clientes/:id/permissoes', atualizarPermissoes);
router.patch('/clientes/:id/limite-acessos', atualizarLimiteAcessos);
router.patch('/clientes/:id/ad-account', atualizarAdAccount);
router.get('/clientes/:id/plano', getPlanoCliente);
router.get('/stats', getStats);

// WhatsApp multi-tenant (admin)
router.get('/whatsapp', getAllStatus);
router.get('/whatsapp/:id/status', adminGetStatus);
router.post('/whatsapp/:id/connect', adminConectar);
router.delete('/whatsapp/:id/session', adminDeletarSessao);

module.exports = router;
