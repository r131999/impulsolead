const { Router } = require('express');
const { register, login, me, alterarSenha } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, me);
router.put('/password', authMiddleware, alterarSenha);

module.exports = router;
