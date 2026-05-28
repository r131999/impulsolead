const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { subscribe, VAPID_PUBLIC_KEY } = require('../controllers/push.controller');

const router = Router();
router.use(authMiddleware);

router.get('/vapid-public-key', (req, res) => res.json({ key: VAPID_PUBLIC_KEY }));
router.post('/subscribe', subscribe);

module.exports = router;
