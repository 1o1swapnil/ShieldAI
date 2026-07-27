-- v1.0 base: authentication (Sections 6-7). Real login + SSO, replacing
-- the "trust whatever org_id/user_id the client sends" model every prior
-- endpoint used.

ALTER TABLE users
    ADD COLUMN password_hash TEXT,                              -- NULL for SSO-only accounts
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'employee',     -- admin | employee
    ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'password', -- password | sso
    ADD COLUMN sso_issuer VARCHAR(255),
    ADD COLUMN sso_subject VARCHAR(255);

CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_sso ON users(sso_issuer, sso_subject) WHERE sso_subject IS NOT NULL;
