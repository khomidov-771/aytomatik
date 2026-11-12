ALTER TABLE instagram_accounts
  ADD COLUMN IF NOT EXISTS login_mode text NOT NULL DEFAULT 'unified';

ALTER TABLE instagram_accounts
  DROP CONSTRAINT IF EXISTS instagram_accounts_login_mode_check;

ALTER TABLE instagram_accounts
  ADD CONSTRAINT instagram_accounts_login_mode_check
  CHECK (login_mode IN ('instagram', 'unified'));

-- Accounts created before this migration used the configured Unified Login
-- flow. Keep them on that graph host until they explicitly reconnect.
