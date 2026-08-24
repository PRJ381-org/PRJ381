const express = require('express');
const { listFeedback } = require('../controllers/feedback.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, requireRole(['admin']), listFeedback);

module.exports = router;
