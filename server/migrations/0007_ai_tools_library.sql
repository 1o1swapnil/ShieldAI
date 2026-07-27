-- v1.0 base: real AI tool library (Section 12), replacing the ai_tools stub.

ALTER TABLE ai_tools
    ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'other',
    ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'admin_manual', -- library_seed | classifier_confirmed | admin_manual
    ADD COLUMN added_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX idx_ai_tools_category ON ai_tools(category);
