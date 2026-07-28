#!/bin/sh
set -e

node scripts/migrate.js
node seeds/seed-ai-tools.js
exec node src/index.js
