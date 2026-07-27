-- Section 1: Detection Coverage / Coverage Map (v1.1 addendum)

-- 1.2: coverage-map input for the "browser, managed device, no extension"
-- row. Toggled by the org admin once DNS/proxy log forwarding is set up on
-- their side — ShieldAI has no way to detect this itself.
ALTER TABLE organizations
    ADD COLUMN dns_proxy_configured BOOLEAN NOT NULL DEFAULT FALSE;

-- 1.3: native-app egress detection log. Reuses ai_tools for domain matching
-- — "a different collection agent," not a new detection engine.
CREATE TABLE native_app_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    process_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    ai_tool_id UUID REFERENCES ai_tools(id),
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_native_app_detections_org ON native_app_detections(org_id);

-- 1.4: SaaS/API discovery via SSO OAuth-grant scan (or expense data /
-- manual entry). Exact schema from the addendum.
CREATE TABLE discovered_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,        -- 'sso_oauth_grant' | 'expense_report' | 'admin_manual'
    tool_name VARCHAR(255),
    matched_ai_tool_id UUID REFERENCES ai_tools(id),  -- NULL if unmatched
    discovered_via TEXT,                 -- e.g. 'Okta OAuth grant: "OpenAI API" scope'
    requesting_user_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'unreviewed', -- unreviewed | confirmed | dismissed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discovered_integrations_org ON discovered_integrations(org_id);
