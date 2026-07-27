const express = require('express');
const pool = require('../db');
const { defaultActionFor, explain } = require('../classifier/score');
const { classifyDomain } = require('../classifier/classifyDomain');
const { upsertUnverifiedTool } = require('../classifier/queue');

const router = express.Router();

// Entry point for "a previously-unseen domain visited by a monitored user"
// (2.1). Runs the full feature pipeline and, above the alert-fatigue floor,
// queues the domain for admin review. Manual/direct-test endpoint — the
// real ingestion path is POST /activity/events (Section 8), which computes
// aggregate org-behavior signals from stored events instead of trusting
// client-supplied numbers.
router.post('/classify', async (req, res) => {
  const { org_id, domain, title, script_hints, distinct_users, avg_session_seconds } = req.body || {};
  if (!org_id || !domain) {
    return res.status(400).json({ error: 'org_id and domain are required' });
  }

  const { confidence, featureSnapshot, defaultAction, explanation } = await classifyDomain({
    domain,
    title,
    scriptHints: script_hints,
    distinctUsers: distinct_users,
    avgSessionSeconds: avg_session_seconds,
  });

  if (!defaultAction) {
    // <60: logged but not flagged, to avoid alert fatigue.
    return res.json({ surfaced: false, ml_confidence: confidence });
  }

  const queued = await upsertUnverifiedTool(pool, { orgId: org_id, domain, confidence, featureSnapshot });

  res.json({ surfaced: true, default_action: defaultAction, explanation, ...queued });
});

// Paginated queue, sorted by ml_confidence DESC (2.5).
router.get('/unverified', async (req, res) => {
  const { org_id, limit = 50, offset = 0 } = req.query;
  if (!org_id) return res.status(400).json({ error: 'org_id is required' });

  const { rows } = await pool.query(
    `SELECT id, domain, ml_confidence, feature_snapshot, first_seen_at, times_seen, review_status, reviewed_by, reviewed_at
     FROM unverified_tools_queue
     WHERE org_id = $1
     ORDER BY ml_confidence DESC
     LIMIT $2 OFFSET $3`,
    [org_id, limit, offset]
  );

  res.json(
    rows.map((row) => ({
      ...row,
      default_action: defaultActionFor(row.ml_confidence),
      explanation: row.feature_snapshot ? explain(row.feature_snapshot) : [],
    }))
  );
});

// confirmed_ai creates a real ai_tools row + (implicitly, via review_status)
// becomes a labeled training example for the next retraining pass (2.4).
router.patch('/unverified/:id', async (req, res) => {
  const { review_status, reviewed_by } = req.body || {};
  if (!['confirmed_ai', 'dismissed'].includes(review_status)) {
    return res.status(400).json({ error: "review_status must be 'confirmed_ai' or 'dismissed'" });
  }

  const { rows } = await pool.query(
    `UPDATE unverified_tools_queue
     SET review_status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3
     RETURNING domain`,
    [review_status, reviewed_by || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });

  let aiToolId = null;
  if (review_status === 'confirmed_ai') {
    const { rows: toolRows } = await pool.query(
      `INSERT INTO ai_tools (name, domain) VALUES ($1, $2)
       ON CONFLICT (domain) DO UPDATE SET domain = EXCLUDED.domain
       RETURNING id`,
      [rows[0].domain, rows[0].domain]
    );
    aiToolId = toolRows[0].id;
  }

  res.json({ review_status, ai_tool_id: aiToolId });
});

module.exports = router;
