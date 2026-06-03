const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/tour.controller');

const router = Router();

// Rota pública — sem autenticação
router.get('/publico/:slug', ctrl.buscarTourPublico);

// Todas as rotas abaixo exigem autenticação
router.use(authMiddleware);

// Tours
router.get('/', requireRole('gestor', 'admin', 'gerente'), ctrl.listarTours);
router.post('/', requireRole('gestor', 'admin'), ctrl.criarTour);
router.get('/:id', requireRole('gestor', 'admin', 'gerente'), ctrl.buscarTour);
router.put('/:id', requireRole('gestor', 'admin'), ctrl.atualizarTour);
router.delete('/:id', requireRole('gestor', 'admin'), ctrl.excluirTour);

// Cômodos — reordenar antes de :comodoId para não conflitar
router.post('/:id/comodos', requireRole('gestor', 'admin'), ctrl.adicionarComodo);
router.put('/:id/comodos/reordenar', requireRole('gestor', 'admin'), ctrl.reordenarComodos);
router.put('/:id/comodos/:comodoId', requireRole('gestor', 'admin'), ctrl.atualizarComodo);
router.delete('/:id/comodos/:comodoId', requireRole('gestor', 'admin'), ctrl.excluirComodo);

// Fotos
router.post('/:id/comodos/:comodoId/fotos', requireRole('gestor', 'admin'), ctrl.uploadFotoComodo);
router.put('/:id/comodos/:comodoId/fotos/reordenar', requireRole('gestor', 'admin'), ctrl.reordenarFotos);
router.delete('/:id/comodos/:comodoId/fotos/:fotoId', requireRole('gestor', 'admin'), ctrl.excluirFoto);

module.exports = router;
