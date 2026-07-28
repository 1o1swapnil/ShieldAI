#!/bin/sh
set -e

# Runs once, automatically, on a brand-new Postgres data volume (the
# official postgres image's docker-entrypoint-initdb.d convention — it does
# NOT re-run against an existing volume from before this change; those need
# the same CREATE ROLE/GRANT statements applied manually once).
#
# server/src/db.js (the app's runtime Pool) previously connected as the
# same superuser role migrations use for CREATE EXTENSION/CREATE ROLE. A
# future SQL-injection-class bug would then have superuser blast radius —
# read every org's rows bypassing every app-level WHERE org_id = $1 scope,
# COPY ... PROGRAM for host command execution, CREATE EXTENSION, etc. —
# instead of being contained to exactly the DML the app actually issues.
# This gives the app pool its own least-privilege role instead.
#
# The tables themselves don't exist yet at this point (migrations run later,
# from the server container's entrypoint, as the superuser) — the ALTER
# DEFAULT PRIVILEGES statements below are what make the grant apply to
# those tables once they're created, since default privileges are scoped to
# "objects this role creates in the future," and migrations create every
# table as this same superuser role.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shieldai_app') THEN
	    CREATE ROLE shieldai_app LOGIN PASSWORD '$APP_DB_PASSWORD';
	  END IF;
	END
	\$\$;

	GRANT USAGE ON SCHEMA public TO shieldai_app;
	GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shieldai_app;
	GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shieldai_app;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shieldai_app;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO shieldai_app;
EOSQL
