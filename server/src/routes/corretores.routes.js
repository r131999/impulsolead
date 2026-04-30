const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const {
  listar, buscarFila, criar, atualizar, atualizarDisponibilidade, remover,
} = require('../controllers/corretores.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', listar);
router.get('/fila', buscarFila);
router.post('/', criar);
router.put('/:id', atualizar);
router.put('/:id/disponibilidade', atualizarDisponibilidade);
router.delete('/:id', remover);

module.exports = router;
