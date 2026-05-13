const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { chat } = require('../controllers/chat.controller');

const router = express.Router();

router.use(authMiddleware);
router.post('/', chat);

module.exports = router;
