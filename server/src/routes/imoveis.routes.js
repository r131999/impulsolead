const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { requirePermissao } = require('../middleware/permissao.middleware');
const { listar, criar, atualizar, remover } = require('../controllers/imoveis.controller');

const router = express.Router();

router.use(authMiddleware);
router.use(requirePermissao('gestaoImoveis'));
router.use(requireRole('gestor', 'gerente', 'admin'));

router.get('/', listar);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', remover);

module.exports = router;
