-- users.email was case-sensitive everywhere: a plain UNIQUE index plus no
-- normalization in application code. Every real mail provider (Gmail,
-- Microsoft 365, Google Workspace) folds local-part case on delivery
-- regardless of what RFC 5321 technically permits, so a case-flipped
-- variant of an existing address (e.g. "Victim@Company.com" vs
-- "victim@company.com") was treated as a brand-new, unrelated user by
-- every case-sensitive lookup built on top of `email` — most concretely,
-- it let an attacker bypass the register-device cross-org guard
-- (server/src/routes/extension.js) by registering a case-flipped variant
-- of a real victim's address under their own org's install token.
--
-- Drop the case-sensitive constraint before lowercasing existing data (so
-- the UPDATE itself can't fail on a row that would collide once lowered),
-- then enforce case-insensitive uniqueness at the DB level going forward
-- (belt-and-suspenders alongside the application-level normalization added
-- in the same change). If genuine pre-existing case-variant duplicates
-- exist, the final CREATE UNIQUE INDEX fails loudly rather than silently
-- picking a winner — those need manual resolution, there are none expected
-- at this project's current (pre-launch, no live customer data) stage.
DROP INDEX idx_users_email;
UPDATE users SET email = LOWER(email);
CREATE UNIQUE INDEX idx_users_email ON users(LOWER(email));
