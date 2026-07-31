// Central write path for every admin action that grants, revokes, or
// reviews something on another user's behalf — see migrations/0014.
async function logAudit(pool, { orgId, actorUserId, action, targetType, targetId, metadata }) {
  await pool.query(
    `INSERT INTO audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orgId, actorUserId, action, targetType, targetId || null, metadata ? JSON.stringify(metadata) : null]
  );
}

module.exports = { logAudit };
