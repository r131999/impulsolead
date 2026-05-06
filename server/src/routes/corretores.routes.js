const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  listar, buscarFila, criar, atualizar, atualizarDisponibilidade, remover, ativarAcesso, resetarSenha,
} = require('../controllers/corretores.controller');

const router = Router();
router.use(authMiddleware);
router.use(requireRole('gestor', 'admin'));

router.get('/', listar);
router.get('/fila', buscarFila);
router.post('/', criar);
router.put('/:id', atualizar);
router.put('/:id/disponibilidade', atualizarDisponibilidade);
router.post('/:id/ativar-acesso', ativarAcesso);
router.put('/:id/resetar-senha', resetarSenha);
router.delete('/:id', remover);

module.exports = router;
