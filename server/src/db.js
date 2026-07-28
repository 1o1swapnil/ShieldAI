const { Pool } = require('pg');

// APP_DATABASE_URL is a least-privilege role (see
// server/scripts/init-app-role.sh) — the app's own request-serving queries
// never need the superuser DATABASE_URL migrations run as. Falls back to
// DATABASE_URL so local dev/tests that only set one var still work.
const pool = new Pool({
  connectionString: process.env.APP_DATABASE_URL || process.env.DATABASE_URL || 'postgres://localhost:5432/shieldai',
});

module.exports = pool;
