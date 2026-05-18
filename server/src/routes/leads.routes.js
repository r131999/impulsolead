const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  listar, buscarPorId, criar, atualizar, mudarStatus, remover, detalhes, getHistoricoConversa, distribuir, listarHistoricoDistribuicao,
} = require('../controllers/leads.controller');
const { criar: criarFollowUp } = require('../controllers/followups.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', listar);
router.get('/historico-distribuicao', requireRole('gestor', 'admin', 'gerente'), listarHistoricoDistribuicao);
router.get('/:id', buscarPorId);
router.post('/', requireRole('gestor', 'admin'), criar);
router.put('/:id', atualizar);
router.put('/:id/status', mudarStatus);
router.put('/:id/detalhes', detalhes);
router.delete('/:id', requireRole('gestor', 'admin'), remover);
router.put('/:id/distribuir', requireRole('gestor', 'admin', 'gerente'), distribuir);
router.post('/:id/followup', criarFollowUp);
router.get('/:id/historico', getHistoricoConversa);

module.exports = router;
