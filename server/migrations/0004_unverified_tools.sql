-- Section 2: Unknown AI Tool Classifier (v1.1 addendum)

-- Minimal stub — the real 150+ tool library is Section 12, not built yet.
-- Confirmed unverified-tool rows get inserted here (2.5).
CREATE TABLE ai_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE unverified_tools_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    ml_confidence INTEGER NOT NULL,       -- 0-100
    feature_snapshot JSONB,               -- feature values at classification time, for explainability
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    times_seen INTEGER DEFAULT 1,
    reviewed_by UUID REFERENCES users(id),
    review_status VARCHAR(50) DEFAULT 'pending', -- pending | confirmed_ai | dismissed
    reviewed_at TIMESTAMPTZ,
    UNIQUE (org_id, domain)
);

CREATE INDEX idx_unverified_tools_queue_org_confidence ON unverified_tools_queue(org_id, ml_confidence DESC);
