#!/bin/sh
# Restores a pg_dump custom-format file (from backup.sh) into the
# docker-compose postgres service's shieldai DB, dropping and recreating
# every object first (--clean --if-exists) so the target ends up exactly
# matching the dump instead of merging with whatever's already there. Runs
# pg_restore inside the postgres container itself, for the same version-match
# reason backup.sh runs pg_dump there.
set -e
root="$(cd "$(dirname "$0")/../.." && pwd)"
file="$1"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "usage: restore.sh <dump-file> [--yes]" >&2
  exit 1
fi

if [ "$2" != "--yes" ]; then
  printf 'This will DROP and recreate every object in shieldai, replacing it with %s. Continue? [y/N] ' "$file"
  read -r reply
  case "$reply" in
    y|Y) ;;
    *) echo "aborted"; exit 1 ;;
  esac
fi

docker compose -f "$root/docker-compose.yml" exec -T postgres \
  pg_restore -U postgres -d shieldai --clean --if-exists --no-owner < "$file"
echo "restored $file"
