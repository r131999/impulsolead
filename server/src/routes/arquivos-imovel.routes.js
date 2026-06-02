const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { enviar, listar, remover, download, receberChunk, finalizarChunk } = require('../controllers/arquivos-imovel.controller');

const router = Router();
router.use(authMiddleware);

router.post('/chunk', requireRole('gestor', 'admin', 'gerente'), receberChunk);
router.post('/chunk/finalizar', requireRole('gestor', 'admin', 'gerente'), finalizarChunk);
router.post('/', requireRole('gestor', 'admin', 'gerente'), enviar);
router.get('/', listar);
router.get('/:id/download', download);
router.delete('/:id', requireRole('gestor', 'admin', 'gerente'), remover);

module.exports = router;
