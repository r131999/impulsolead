const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { listar, criar, atualizar, remover, resetarSenha } = require('../controllers/usuarios.controller');

const router = Router();
router.use(authMiddleware);
router.use(requireRole('gestor', 'admin'));

router.get('/', listar);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', remover);
router.put('/:id/senha', resetarSenha);

module.exports = router;
