-- Section 3: Extension Trust & Permission Footprint (v1.1 addendum)

-- 3.3: reviewed, signed builds. One row per version ShieldAI has actually
-- published — the source of truth an org's security team checks installs against.
CREATE TABLE extension_builds (
    version VARCHAR(50) PRIMARY KEY,
    build_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL,
    released_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3: what's actually deployed. The service worker self-reports version +
-- build_hash on every /extension/config poll; verified = build_hash matches
-- the reviewed extension_builds row for that version.
CREATE TABLE extension_installs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    extension_version VARCHAR(50) NOT NULL,
    build_hash VARCHAR(64) NOT NULL,
    optional_host_permission_granted BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

CREATE INDEX idx_extension_installs_org ON extension_installs(org_id);
