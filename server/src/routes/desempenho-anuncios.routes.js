const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { requirePermissao } = require('../middleware/permissao.middleware');
const { getDesempenhoAnuncios, sincronizarAnuncios } = require('../controllers/desempenho-anuncios.controller');

const router = Router();
router.use(authMiddleware);
router.use(requirePermissao('painelCampanhas'));

router.get('/', requireRole('gestor', 'admin'), getDesempenhoAnuncios);
router.post('/sincronizar', requireRole('gestor', 'admin'), sincronizarAnuncios);

module.exports = router;
