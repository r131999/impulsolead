const { Router } = require('express');
const { register, login, me, alterarSenha, loginCorretor, alterarSenhaCorretor } = require('../controllers/auth.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login-corretor', loginCorretor);
router.get('/me', authMiddleware, me);
router.put('/password', authMiddleware, requireRole('gestor', 'admin'), alterarSenha);
router.put('/corretor/password', authMiddleware, requireRole('corretor'), alterarSenhaCorretor);

module.exports = router;
