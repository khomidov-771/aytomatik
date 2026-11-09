-- A provider account may be actively connected to only one workspace. This
-- makes provider webhook routing deterministic and prevents tenant crossover.
-- Legacy mock accounts used one shared provider ID; convert them before adding
-- the global active-account constraint so existing demo workspaces migrate.
UPDATE instagram_accounts
SET instagram_user_id = 'mock-' || workspace_id::text,
    username = 'ids.demo.' || left(workspace_id::text, 8)
WHERE provider = 'mock' AND status = 'connected';

CREATE UNIQUE INDEX IF NOT EXISTS instagram_accounts_active_provider_uidx
  ON instagram_accounts(provider, instagram_user_id)
  WHERE status = 'connected';

-- Provider message IDs are the idempotency key for inbound and outbound inbox
-- records. NULL remains allowed for legacy/provider-less rows.
CREATE UNIQUE INDEX IF NOT EXISTS messages_provider_message_uidx
  ON messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
