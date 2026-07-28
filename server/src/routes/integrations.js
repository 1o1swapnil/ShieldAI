const express = require('express');
const pool = require('../db');
const { fuzzyMatchAiTool } = require('../fuzzyMatch');
const { requireAuth, requireAdmin, requireOrgMatch } = require('../auth/middleware');

const router = express.Router();

// 1.4: ingest OAuth application grants already pulled from Okta/Azure AD
// (the SSO connector itself is Section 6, not built) and match them against
// the ai_tools library. This is the "Sarah authorized 'OpenAI API access'
// via Okta" flow — no network visibility required.
router.post('/scan', requireAuth, requireAdmin, requireOrgMatch((req) => req.body?.org_id), async (req, res) => {
  const { org_id, grants } = req.body || {};
  if (!Array.isArray(grants)) {
    return res.status(400).json({ error: 'grants[] is required' });
  }

  const { rows: aiTools } = await pool.query('SELECT id, name, domain FROM ai_tools');

  const inserted = [];
  for (const grant of grants) {
    const matchedAiToolId = fuzzyMatchAiTool(grant.tool_name, aiTools);
    const { rows } = await pool.query(
      `INSERT INTO discovered_integrations (org_id, source, tool_name, matched_ai_tool_id, discovered_via, requesting_user_id)
       VALUES ($1, 'sso_oauth_grant', $2, $3, $4, $5)
       RETURNING id, tool_name, matched_ai_tool_id, status, created_at`,
      [org_id, grant.tool_name, matchedAiToolId, grant.discovered_via || null, grant.requesting_user_id || null]
    );
    inserted.push(rows[0]);
  }

  res.status(201).json(inserted);
});

router.get('/discovered', requireAuth, requireAdmin, requireOrgMatch((req) => req.query.org_id), async (req, res) => {
  const { org_id } = req.query;

  const { rows } = await pool.query(
    `SELECT id, source, tool_name, matched_ai_tool_id, discovered_via, requesting_user_id, status, created_at
     FROM discovered_integrations
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [org_id]
  );
  res.json(rows);
});

router.patch('/discovered/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['confirmed', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: "status must be 'confirmed' or 'dismissed'" });
  }

  const { rows: existing } = await pool.query('SELECT org_id FROM discovered_integrations WHERE id = $1', [
    req.params.id,
  ]);
  if (!existing.length) return res.status(404).json({ error: 'not found' });
  if (existing[0].org_id !== req.user.orgId) return res.status(403).json({ error: 'org mismatch' });

  const { rows } = await pool.query(
    `UPDATE discovered_integrations SET status = $1 WHERE id = $2 RETURNING id, status`,
    [status, req.params.id]
  );
  res.json(rows[0]);
});

module.exports = router;
