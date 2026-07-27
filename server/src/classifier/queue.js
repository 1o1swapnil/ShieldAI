// Shared unverified_tools_queue upsert (2.5), used by both /tools/classify
// and the real activity-ingestion path so a domain gets one queue row no
// matter which caller first saw it.
async function upsertUnverifiedTool(pool, { orgId, domain, confidence, featureSnapshot }) {
  const { rows } = await pool.query(
    `INSERT INTO unverified_tools_queue (org_id, domain, ml_confidence, feature_snapshot)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, domain) DO UPDATE SET
       ml_confidence = EXCLUDED.ml_confidence,
       feature_snapshot = EXCLUDED.feature_snapshot,
       times_seen = unverified_tools_queue.times_seen + 1
     RETURNING id, domain, ml_confidence, times_seen, first_seen_at, review_status`,
    [orgId, domain, confidence, featureSnapshot]
  );
  return rows[0];
}

module.exports = { upsertUnverifiedTool };
