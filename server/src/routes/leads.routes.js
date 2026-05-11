const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  listar, buscarPorId, criar, atualizar, mudarStatus, remover, detalhes, getHistoricoConversa,
} = require('../controllers/leads.controller');
const { criar: criarFollowUp } = require('../controllers/followups.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', listar);
router.get('/:id', buscarPorId);
router.post('/', requireRole('gestor', 'admin'), criar);
router.put('/:id', atualizar);
router.put('/:id/status', mudarStatus);
router.put('/:id/detalhes', detalhes);
router.delete('/:id', requireRole('gestor', 'admin'), remover);
router.post('/:id/followup', criarFollowUp);
router.get('/:id/historico', getHistoricoConversa);

module.exports = router;
