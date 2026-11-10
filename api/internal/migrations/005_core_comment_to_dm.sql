-- Core product migration: billing data remains intact for historical/audit
-- purposes, but the application no longer reads or writes plan/subscription
-- state. Existing automation rows are backfilled without deleting tenant data.

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS private_reply_text text,
  ADD COLUMN IF NOT EXISTS public_success_reply_text text,
  ADD COLUMN IF NOT EXISTS public_not_follower_reply_text text,
  ADD COLUMN IF NOT EXISTS public_unknown_reply_text text,
  ADD COLUMN IF NOT EXISTS follow_verification_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unknown_fallback_policy text NOT NULL DEFAULT 'skip_dm_neutral_reply';

UPDATE automation_rules
SET private_reply_text = COALESCE(NULLIF(private_reply_text, ''), reply_text),
    public_success_reply_text = COALESCE(NULLIF(public_success_reply_text, ''), 'Direct xabaringizga yubordik! 📩'),
    public_not_follower_reply_text = COALESCE(NULLIF(public_not_follower_reply_text, ''), 'Avval sahifamizga obuna bo''ling! 😊'),
    public_unknown_reply_text = COALESCE(NULLIF(public_unknown_reply_text, ''), 'Iltimos, sahifamizga obuna bo''ling va Direct orqali yozing.');

ALTER TABLE automation_rules
  ALTER COLUMN private_reply_text SET NOT NULL,
  ALTER COLUMN public_success_reply_text SET NOT NULL,
  ALTER COLUMN public_not_follower_reply_text SET NOT NULL,
  ALTER COLUMN public_unknown_reply_text SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_rules_unknown_fallback_check') THEN
    ALTER TABLE automation_rules
      ADD CONSTRAINT automation_rules_unknown_fallback_check
      CHECK (unknown_fallback_policy IN ('send_private_reply','skip_dm_neutral_reply'));
  END IF;
END $$;

ALTER TABLE automation_executions
  ADD COLUMN IF NOT EXISTS follow_status text NOT NULL DEFAULT 'NOT_CHECKED',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_executions_follow_status_check') THEN
    ALTER TABLE automation_executions
      ADD CONSTRAINT automation_executions_follow_status_check
      CHECK (follow_status IN ('NOT_CHECKED','FOLLOWER','NOT_FOLLOWER','UNKNOWN'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS automation_execution_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES automation_executions(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('follow_check','private_reply','public_reply')),
  status text NOT NULL CHECK (status IN ('sending','succeeded','failed','failed_retryable','unknown','skipped')),
  message_text text,
  outcome text,
  provider_result_id text,
  error_code text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(execution_id, action_type)
);

CREATE INDEX IF NOT EXISTS automation_actions_history_idx
  ON automation_execution_actions(workspace_id, updated_at DESC);

-- Mock product data is preserved for audit, but it can no longer appear as a
-- connected account or execute rules. The old public demo credentials are
-- invalidated without deleting the user's historical rows.
UPDATE automation_rules r
SET is_active = false, updated_at = now()
FROM instagram_accounts a
WHERE r.instagram_account_id = a.id AND a.provider = 'mock' AND r.is_active = true;

UPDATE instagram_accounts
SET status = 'disconnected', token_ciphertext = '', last_sync_at = now()
WHERE provider = 'mock' AND status = 'connected';

DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'demo@ids.uz');
UPDATE users SET password_hash = 'disabled-legacy-demo-account' WHERE email = 'demo@ids.uz';
