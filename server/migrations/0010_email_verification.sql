-- Closes the identity-spoofing gap: register-device and /auth/register
-- previously accepted any email with zero proof of ownership, so an
-- employee could type a colleague's address and the audit trail
-- (consent_log, activity_events) would be attributed to the wrong person.

ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN verified_at TIMESTAMPTZ;

-- Grandfather everything that existed before this gate — otherwise every
-- pre-existing account and device silently locks out the moment this ships.
UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL;
UPDATE devices SET verified_at = NOW() WHERE verified_at IS NULL;
