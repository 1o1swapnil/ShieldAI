-- users.org_id was never NOT NULL at the schema level, even though every
-- INSERT path (register, register-device, SSO provisioning) has always
-- supplied a real org_id from a validated source. No exploitable path
-- currently relies on this gap, but it's cheap defense-in-depth: a future
-- bug that omits org_id should fail loudly at the DB layer instead of
-- silently creating an orphaned, org-less user that app-level org-scoping
-- checks were never written to expect.
ALTER TABLE users ALTER COLUMN org_id SET NOT NULL;
