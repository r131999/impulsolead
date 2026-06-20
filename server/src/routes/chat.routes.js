const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { requirePermissao } = require('../middleware/permissao.middleware');
const { chat } = require('../controllers/chat.controller');

const router = express.Router();

router.use(authMiddleware);
router.use(requirePermissao('agenteIA'));
router.post('/', chat);

module.exports = router;
