async function createSession(pool, { userId, orgId }) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, org_id) VALUES ($1, $2) RETURNING id`,
    [userId, orgId]
  );
  return rows[0].id;
}

module.exports = { createSession };
