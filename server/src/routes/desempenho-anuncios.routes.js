const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getDesempenhoAnuncios } = require('../controllers/desempenho-anuncios.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', requireRole('gestor', 'admin'), getDesempenhoAnuncios);

module.exports = router;
