// Dev-time only: computes a deterministic hash over the shipped extension
// files and writes build-info.json, which background.js reads at runtime to
// self-report what it's actually running (Section 3.3). Re-run on every
// release before signing.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILES = [
  'manifest.json',
  'background.js',
  'notice.html',
  'notice.js',
  'permission-request.html',
  'permission-request.js',
  'rules.json',
];

const hash = crypto.createHash('sha256');
for (const file of [...FILES].sort()) {
  hash.update(fs.readFileSync(path.join(__dirname, file)));
}

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const buildInfo = { version: manifest.version, build_hash: hash.digest('hex') };

fs.writeFileSync(path.join(__dirname, 'build-info.json'), JSON.stringify(buildInfo, null, 2) + '\n');
console.log(`wrote build-info.json: ${JSON.stringify(buildInfo)}`);
