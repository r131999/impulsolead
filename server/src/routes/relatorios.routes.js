const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { getRelatorios } = require('../controllers/relatorios.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', getRelatorios);

module.exports = router;
