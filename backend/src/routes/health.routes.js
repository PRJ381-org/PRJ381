const express = require('express');
const { dbState } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    db: dbState() === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
