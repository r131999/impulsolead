const { Router } = require('express');
const { register, login, me, alterarSenha, loginCorretor, alterarSenhaCorretor, atualizarFotoPerfilGestor, atualizarFotoPerfilCorretor, loginSupremo, setupSupremo } = require('../controllers/auth.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login-corretor', loginCorretor);
router.get('/me', authMiddleware, me);
router.put('/password', authMiddleware, requireRole('gestor', 'admin'), alterarSenha);
router.put('/foto-perfil', authMiddleware, requireRole('gestor', 'admin'), atualizarFotoPerfilGestor);
router.put('/corretor/password', authMiddleware, requireRole('corretor'), alterarSenhaCorretor);
router.put('/corretor/foto-perfil', authMiddleware, requireRole('corretor', 'gerente'), atualizarFotoPerfilCorretor);
router.post('/login-supremo', loginSupremo);
router.post('/setup-supremo', setupSupremo);

module.exports = router;
