-- User-session JWTs previously had no revocation path at all — a leaked
-- admin token was valid for its full 24h lifetime with no way to cut it
-- off. Mirrors the devices table: the JWT is long-lived, the DB row is
-- the real kill switch.

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_org ON sessions(org_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
