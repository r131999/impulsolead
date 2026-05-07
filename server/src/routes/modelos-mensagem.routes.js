const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { listar, criar, atualizar, remover } = require('../controllers/modelos-mensagem.controller');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('gestor', 'admin'));

router.get('/', listar);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', remover);

module.exports = router;
