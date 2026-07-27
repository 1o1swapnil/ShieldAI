const express = require('express');
const pool = require('../db');
const { classifyDomain } = require('../classifier/classifyDomain');
const { upsertUnverifiedTool } = require('../classifier/queue');

const router = express.Router();

// The real ingestion path: the extension reports every AI-tool-relevant
// page visit here. Known domains log at full confidence; unknown domains
// run the Section 2 classifier using aggregate signals computed from this
// org's own event history — not a client-supplied number.
router.post('/events', async (req, res) => {
  const { org_id, user_id, domain, title, script_hints, session_id, duration_seconds } = req.body || {};
  if (!org_id || !user_id || !domain) {
    return res.status(400).json({ error: 'org_id, user_id, and domain are required' });
  }

  const { rows: toolRows } = await pool.query('SELECT id FROM ai_tools WHERE domain = $1', [domain]);
  const knownToolId = toolRows[0]?.id || null;

  let confidence = 100;
  let queued = null;

  if (!knownToolId) {
    const { rows: aggRows } = await pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS distinct_users, AVG(duration_seconds)::int AS avg_session_seconds
       FROM activity_events WHERE org_id = $1 AND domain = $2`,
      [org_id, domain]
    );

    const classified = await classifyDomain({
      domain,
      title,
      scriptHints: script_hints,
      distinctUsers: aggRows[0].distinct_users,
      avgSessionSeconds: aggRows[0].avg_session_seconds,
    });
    confidence = classified.confidence;

    if (classified.defaultAction) {
      queued = await upsertUnverifiedTool(pool, {
        orgId: org_id,
        domain,
        confidence: classified.confidence,
        featureSnapshot: classified.featureSnapshot,
      });
    }
  }

  await pool.query(
    `INSERT INTO activity_events (org_id, user_id, domain, ai_tool_id, title, confidence, session_id, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [org_id, user_id, domain, knownToolId, title || null, confidence, session_id || null, duration_seconds || null]
  );

  res.status(201).json({ logged: true, ai_tool_id: knownToolId, confidence, queued: Boolean(queued) });
});

router.get('/events', async (req, res) => {
  const { org_id, limit = 50, offset = 0 } = req.query;
  if (!org_id) return res.status(400).json({ error: 'org_id is required' });

  const { rows } = await pool.query(
    `SELECT id, user_id, domain, ai_tool_id, title, confidence, session_id, duration_seconds, occurred_at
     FROM activity_events
     WHERE org_id = $1
     ORDER BY occurred_at DESC
     LIMIT $2 OFFSET $3`,
    [org_id, limit, offset]
  );
  res.json(rows);
});

// Per-tool usage rollup for the admin dashboard.
router.get('/summary', async (req, res) => {
  const { org_id } = req.query;
  if (!org_id) return res.status(400).json({ error: 'org_id is required' });

  const { rows } = await pool.query(
    `SELECT ae.domain, at.name AS tool_name, COUNT(*)::int AS event_count,
            COUNT(DISTINCT ae.user_id)::int AS distinct_users,
            MAX(ae.occurred_at) AS last_seen_at
     FROM activity_events ae
     LEFT JOIN ai_tools at ON at.id = ae.ai_tool_id
     WHERE ae.org_id = $1
     GROUP BY ae.domain, at.name
     ORDER BY event_count DESC`,
    [org_id]
  );
  res.json(rows);
});

module.exports = router;
