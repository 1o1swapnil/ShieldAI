-- Device-token auth for the extension's own ingestion endpoints (consent
-- acknowledge, extension config self-report, native-app detect, activity
-- events). These are called by an installed device, not a logged-in
-- browser session, so they can't use the Section 7 JWT sessions directly
-- — they get their own credential: an org-scoped install token exchanged
-- once for a long-lived, individually revocable device token.

CREATE TABLE install_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    label VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    install_token_id UUID REFERENCES install_tokens(id),
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ  -- the actual kill switch; the JWT itself is long-lived
);

CREATE INDEX idx_devices_org ON devices(org_id);
