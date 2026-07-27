-- v1.0 base: activity events pipeline (Section 8).
-- The real-time, high-confidence detection layer the extension feeds, and
-- the source of the aggregate org-behavior signal the classifier (Section
-- 2.2) previously had to take as trusted client input.

CREATE TABLE activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    domain VARCHAR(255) NOT NULL,
    ai_tool_id UUID REFERENCES ai_tools(id),  -- NULL until classified/confirmed
    title TEXT,                               -- single DOM read, no full-page content (privacy constraint, Section 11)
    confidence INTEGER,                       -- 100 for a known ai_tools match, else the ML score
    session_id VARCHAR(64),  -- extension-generated, e.g. "tab-<tabId>" — not a DB-issued UUID
    duration_seconds INTEGER,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_events_org_domain ON activity_events(org_id, domain);
CREATE INDEX idx_activity_events_org_time ON activity_events(org_id, occurred_at DESC);
