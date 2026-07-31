// Dev-time only: regenerates rules.json and manifest.json's content_scripts
// match list from the real tool library (server/seeds/ai_tools.json), so the
// extension actually covers all known AI tools instead of the 2-domain
// placeholder. Re-run whenever ai_tools.json changes; `--check` (used by CI)
// exits non-zero instead of writing if the committed files have drifted.
const fs = require('fs');
const path = require('path');

const check = process.argv.includes('--check');

const tools = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'server', 'seeds', 'ai_tools.json'), 'utf8')
);
const domains = [...new Set(tools.map((t) => t.domain))].sort();

const rulesPath = path.join(__dirname, 'rules.json');
const manifestPath = path.join(__dirname, 'manifest.json');

const rules = domains.map((domain, i) => ({
  id: i + 1,
  priority: 1,
  action: { type: 'allow' },
  condition: { urlFilter: `||${domain}`, resourceTypes: ['main_frame'] },
}));
const rulesJson = JSON.stringify(rules, null, 2) + '\n';

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.content_scripts[0].matches = domains.map((domain) => `https://${domain}/*`);
const manifestJson = JSON.stringify(manifest, null, 2) + '\n';

if (check) {
  const driftRules = fs.readFileSync(rulesPath, 'utf8') !== rulesJson;
  const driftManifest = fs.readFileSync(manifestPath, 'utf8') !== manifestJson;
  if (driftRules || driftManifest) {
    console.error(
      'rules.json / manifest.json are stale relative to server/seeds/ai_tools.json — run `node generate-rules.js`.'
    );
    process.exit(1);
  }
  console.log('rules.json and manifest.json content_scripts are up to date.');
  process.exit(0);
}

fs.writeFileSync(rulesPath, rulesJson);
fs.writeFileSync(manifestPath, manifestJson);
console.log(`wrote ${domains.length} domains to rules.json and manifest.json`);
