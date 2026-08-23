const express = require('express');
const { exportLeadsCsv, exportAnalyticsCsv } = require('../controllers/export.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

// GET /api/export/leads (Admin only)
router.get('/leads', requireAuth, requireRole(['admin']), exportLeadsCsv);

// GET /api/export/analytics (Admin only)
router.get('/analytics', requireAuth, requireRole(['admin']), exportAnalyticsCsv);

module.exports = router;
