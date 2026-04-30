const { Router } = require('express');
const { webhookAuthMiddleware } = require('../middleware/webhook.middleware');
const { receberLead } = require('../controllers/webhook.controller');

const router = Router();

router.post('/lead', webhookAuthMiddleware, receberLead);

module.exports = router;
