const express = require('express');
const pool = require('../db');
const { defaultActionFor, explain } = require('../classifier/score');
const { classifyDomain } = require('../classifier/classifyDomain');
const { upsertUnverifiedTool } = require('../classifier/queue');
const { requireAuth, requireAdmin, requireOrgMatch } = require('../auth/middleware');

const router = express.Router();

// Entry point for "a previously-unseen domain visited by a monitored user"
// (2.1). Runs the full feature pipeline and, above the alert-fatigue floor,
// queues the domain for admin review. Manual/direct-test endpoint — the
// real ingestion path is POST /activity/events (Section 8), which computes
// aggregate org-behavior signals from stored events instead of trusting
// client-supplied numbers.
router.post('/classify', requireAuth, requireAdmin, requireOrgMatch((req) => req.body?.org_id), async (req, res) => {
  const { org_id, domain, title, script_hints, distinct_users, avg_session_seconds } = req.body || {};
  if (!domain) {
    return res.status(400).json({ error: 'domain is required' });
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
router.get('/unverified', requireAuth, requireAdmin, requireOrgMatch((req) => req.query.org_id), async (req, res) => {
  const { org_id, limit = 50, offset = 0 } = req.query;

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
// org_id isn't in the URL here, so the org-match check happens inline
// against the row itself rather than via requireOrgMatch.
router.patch('/unverified/:id', requireAuth, requireAdmin, async (req, res) => {
  const { review_status, reviewed_by } = req.body || {};
  if (!['confirmed_ai', 'dismissed'].includes(review_status)) {
    return res.status(400).json({ error: "review_status must be 'confirmed_ai' or 'dismissed'" });
  }

  const { rows: existing } = await pool.query('SELECT org_id FROM unverified_tools_queue WHERE id = $1', [
    req.params.id,
  ]);
  if (!existing.length) return res.status(404).json({ error: 'not found' });
  if (existing[0].org_id !== req.user.orgId) return res.status(403).json({ error: 'org mismatch' });

  const { rows } = await pool.query(
    `UPDATE unverified_tools_queue
     SET review_status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3
     RETURNING domain`,
    [review_status, reviewed_by || null, req.params.id]
  );

  let aiToolId = null;
  if (review_status === 'confirmed_ai') {
    const { rows: toolRows } = await pool.query(
      `INSERT INTO ai_tools (name, domain, source) VALUES ($1, $2, 'classifier_confirmed')
       ON CONFLICT (domain) DO UPDATE SET domain = EXCLUDED.domain
       RETURNING id`,
      [rows[0].domain, rows[0].domain]
    );
    aiToolId = toolRows[0].id;
  }

  res.json({ review_status, ai_tool_id: aiToolId });
});

// 1.2: "Admin adds internal tool entries to ai_tools" — the manual path for
// self-hosted/internal LLM endpoints domain-matching can't discover on its own.
router.post('/library', requireAuth, requireAdmin, async (req, res) => {
  const { name, domain, category } = req.body || {};
  if (!name || !domain) return res.status(400).json({ error: 'name and domain are required' });

  const { rows } = await pool.query(
    `INSERT INTO ai_tools (name, domain, category, source)
     VALUES ($1, $2, $3, 'admin_manual')
     ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category
     RETURNING id, name, domain, category, source, added_at`,
    [name, domain, category || 'other']
  );
  res.status(201).json(rows[0]);
});

router.get('/library', requireAuth, requireAdmin, async (req, res) => {
  const { category, source } = req.query;
  const conditions = [];
  const params = [];
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (source) {
    params.push(source);
    conditions.push(`source = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT id, name, domain, category, source, added_at FROM ai_tools ${where} ORDER BY name`,
    params
  );
  res.json(rows);
});

module.exports = router;
