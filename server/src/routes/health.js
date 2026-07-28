const express = require('express');
const pool = require('../db');

const router = express.Router();

// Checks the DB round-trip, not just that the process is up — a server that
// can't reach Postgres isn't "healthy" even though it's still accepting
// connections. Unauthenticated by design: this is what the orchestrator/load
// balancer polls.
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: 'error' });
  }
});

module.exports = router;
