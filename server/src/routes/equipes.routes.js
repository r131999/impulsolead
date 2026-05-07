const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  listar, criar, atualizar, remover, adicionarCorretor, removerCorretor,
} = require('../controllers/equipes.controller');

const router = Router();
router.use(authMiddleware);
router.use(requireRole('gestor', 'admin'));

router.get('/', listar);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', remover);
router.post('/:id/corretores', adicionarCorretor);
router.delete('/:id/corretores/:corretorId', removerCorretor);

module.exports = router;
