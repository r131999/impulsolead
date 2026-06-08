const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getDesempenhoAnuncios, sincronizarAnuncios } = require('../controllers/desempenho-anuncios.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', requireRole('gestor', 'admin'), getDesempenhoAnuncios);
router.post('/sincronizar', requireRole('gestor', 'admin'), sincronizarAnuncios);

module.exports = router;
