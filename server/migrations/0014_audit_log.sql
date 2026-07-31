-- Unified admin audit log: one place to look for every admin action that
-- grants, revokes, or reviews something on another user's behalf, instead
-- of reconstructing it from reviewed_by/revoked_at columns scattered
-- across devices, sessions, unverified_tools_queue, discovered_integrations.
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_created ON audit_log (org_id, created_at DESC);
