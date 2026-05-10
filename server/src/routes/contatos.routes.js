const express = require('express');
const multer = require('multer');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { importar, listar, remover, enviarMensagem, transferir, limpar } = require('../controllers/contatos.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(requireRole('gestor', 'admin'));

router.post('/importar', upload.single('arquivo'), importar);
router.get('/', listar);
router.delete('/limpar', limpar);
router.delete('/:id', remover);
router.post('/:id/enviar', enviarMensagem);
router.post('/:id/transferir', transferir);

module.exports = router;
