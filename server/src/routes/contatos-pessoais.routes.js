const express = require('express');
const multer = require('multer');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { cadastrar, importar, listar, remover, converter } = require('../controllers/contatos-pessoais.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(requireRole('corretor', 'gerente'));

router.post('/', cadastrar);
router.post('/importar', upload.single('arquivo'), importar);
router.get('/', listar);
router.delete('/:id', remover);
router.post('/:id/converter', converter);

module.exports = router;
