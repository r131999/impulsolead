const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { atualizar, remover, pendentes } = require('../controllers/followups.controller');

const router = Router();
router.use(authMiddleware);

router.get('/pendentes', pendentes);
router.put('/:id', atualizar);
router.delete('/:id', remover);

module.exports = router;
