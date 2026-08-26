const express = require('express');
const { dbState } = require('../db');
const { NODE_ENV } = require('../config/env');
const { version } = require('../../package.json');

const router = express.Router();

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// A deploy restarts the process, so a recent startedAt confirms new code is live.
const startedAt = new Date().toISOString();

router.get('/', (req, res) => {
  const state = dbState();
  res.status(200).json({
    status: 'ok',
    version,
    commit: process.env.GITHUB_SHA || process.env.SCM_COMMIT_ID || null,
    env: NODE_ENV,
    db: READY_STATES[state] || 'unknown',
    dbState: state,
    startedAt,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
