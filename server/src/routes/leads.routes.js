const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const {
  listar, buscarPorId, criar, atualizar, mudarStatus, remover,
} = require('../controllers/leads.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', listar);
router.get('/:id', buscarPorId);
router.post('/', criar);
router.put('/:id', atualizar);
router.put('/:id/status', mudarStatus);
router.delete('/:id', remover);

module.exports = router;
