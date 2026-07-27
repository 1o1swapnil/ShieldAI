// Seeds the ai_tools library (Section 12) — run once after migrations, or
// again any time the seed list grows. Idempotent: existing domains
// (including ones a customer's admin or the classifier already added) are
// left untouched.
const { Pool } = require('pg');
const tools = require('./ai_tools.json');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let inserted = 0;

  for (const tool of tools) {
    const { rowCount } = await pool.query(
      `INSERT INTO ai_tools (name, domain, category, source)
       VALUES ($1, $2, $3, 'library_seed')
       ON CONFLICT (domain) DO NOTHING`,
      [tool.name, tool.domain, tool.category]
    );
    inserted += rowCount;
  }

  console.log(`seeded ${inserted}/${tools.length} tools (${tools.length - inserted} already present)`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
