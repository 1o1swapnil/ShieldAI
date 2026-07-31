#!/bin/sh
# Dumps the docker-compose postgres service's shieldai DB to a timestamped
# custom-format file in server/backups/ (gitignored). Runs pg_dump inside the
# postgres container itself, not a host-installed client, so the dump tool
# version always matches the server's — a mismatched host pg_dump can
# produce a dump the server's own pg_restore rejects.
set -e
root="$(cd "$(dirname "$0")/../.." && pwd)"
dir="$root/server/backups"
mkdir -p "$dir"
file="$dir/shieldai-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose -f "$root/docker-compose.yml" exec -T postgres pg_dump -U postgres -d shieldai -Fc > "$file"
echo "wrote $file"
