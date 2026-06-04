const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/apresentacao.controller');

const router = Router();

// Rotas públicas — sem autenticação
router.get('/publico/:slug', ctrl.buscarPublico);
router.get('/og/ap/:slug', ctrl.ogApresentacao);

// Rotas autenticadas
router.use(authMiddleware);

const roles = ['gestor', 'admin', 'gerente', 'corretor'];

router.get('/', requireRole(...roles), ctrl.listar);
router.post('/', requireRole(...roles), ctrl.criar);
router.get('/:id', requireRole(...roles), ctrl.buscar);
router.put('/:id', requireRole(...roles), ctrl.atualizar);
router.delete('/:id', requireRole(...roles), ctrl.excluir);
router.post('/:id/fotos', requireRole(...roles), ctrl.uploadFoto);
router.delete('/:id/fotos/:fotoId', requireRole(...roles), ctrl.excluirFoto);
router.post('/:id/video', requireRole(...roles), ctrl.uploadVideo);

module.exports = router;
