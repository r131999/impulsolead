const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const {
  listar, buscarFila, criar, atualizar, atualizarDisponibilidade, remover, ativarAcesso, resetarSenha, atualizarFotoCorretor,
} = require('../controllers/corretores.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', requireRole('gestor', 'admin', 'gerente'), listar);
router.get('/fila', requireRole('gestor', 'admin'), buscarFila);
router.post('/', requireRole('gestor', 'admin'), criar);
router.put('/:id', requireRole('gestor', 'admin'), atualizar);
router.put('/:id/disponibilidade', requireRole('gestor', 'admin'), atualizarDisponibilidade);
router.post('/:id/ativar-acesso', requireRole('gestor', 'admin'), ativarAcesso);
router.put('/:id/resetar-senha', requireRole('gestor', 'admin'), resetarSenha);
router.put('/:id/foto-perfil', requireRole('gestor', 'admin'), atualizarFotoCorretor);
router.delete('/:id', requireRole('gestor', 'admin'), remover);

module.exports = router;
