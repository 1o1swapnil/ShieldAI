-- Section 4: Employee Notice & Consent Mechanics (v1.1 addendum)

CREATE TABLE consent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    org_id UUID REFERENCES organizations(id),
    notice_version VARCHAR(50),
    acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET
);

CREATE INDEX idx_consent_log_user ON consent_log(user_id);

-- 4.2: org-level jurisdiction configuration.
-- "Configured" == at least one jurisdiction selected; gates incognito
-- monitoring and the native-app companion (Section 1.3).
ALTER TABLE organizations
    ADD COLUMN jurisdictions TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN incognito_monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN native_app_companion_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
