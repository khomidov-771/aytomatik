CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email citext UNIQUE NOT NULL,
  password_hash text NOT NULL, email_verified_at timestamptz, preferred_language text NOT NULL DEFAULT 'uz',
  notifications_enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL,
  account_limit int NOT NULL, rule_limit int NOT NULL, event_limit int NOT NULL, price_uzs bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, owner_user_id uuid NOT NULL REFERENCES users(id),
  plan_id uuid REFERENCES plans(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','manager','operator','customer')), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, token_hash bytea UNIQUE NOT NULL, csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id, expires_at);
CREATE TABLE IF NOT EXISTS one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('email_verify','password_reset')), token_hash bytea UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id), state_hash bytea UNIQUE NOT NULL, expires_at timestamptz NOT NULL,
  used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  instagram_user_id text NOT NULL, username text NOT NULL, account_type text NOT NULL, avatar_url text,
  token_ciphertext text NOT NULL, token_expires_at timestamptz, scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'connected', provider text NOT NULL, connected_by uuid NOT NULL REFERENCES users(id),
  connected_at timestamptz NOT NULL DEFAULT now(), last_sync_at timestamptz,
  UNIQUE(workspace_id,instagram_user_id)
);
CREATE INDEX IF NOT EXISTS instagram_accounts_tenant_idx ON instagram_accounts(workspace_id,status);
CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE, name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'comment_created', match_mode text NOT NULL CHECK (match_mode IN ('exact','contains','keyword_list')),
  keywords text[] NOT NULL, exclusions text[] NOT NULL DEFAULT '{}', media_scope text NOT NULL DEFAULT 'all', media_ids text[] NOT NULL DEFAULT '{}',
  reply_text text NOT NULL, is_active boolean NOT NULL DEFAULT true, priority int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rules_tenant_active_idx ON automation_rules(workspace_id,instagram_account_id,is_active,priority);
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_event_id text UNIQUE NOT NULL, workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  instagram_account_id uuid REFERENCES instagram_accounts(id) ON DELETE CASCADE, event_type text NOT NULL,
  payload_redacted jsonb NOT NULL DEFAULT '{}', processing_status text NOT NULL DEFAULT 'queued', error_code text,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS webhooks_queue_idx ON webhook_events(processing_status,received_at);
CREATE TABLE IF NOT EXISTS automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES automation_rules(id) ON DELETE SET NULL, event_id uuid NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  status text NOT NULL, provider_message_id text, error_code text, error_message text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS executions_metrics_idx ON automation_executions(workspace_id,created_at,status);
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  participant_id text NOT NULL, participant_username text NOT NULL, status text NOT NULL DEFAULT 'open', unread_count int NOT NULL DEFAULT 0,
  can_reply_until timestamptz, last_message_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,instagram_account_id,participant_id)
);
CREATE INDEX IF NOT EXISTS conversations_tenant_idx ON conversations(workspace_id,last_message_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  provider_message_id text, direction text NOT NULL CHECK (direction IN ('inbound','outbound')), message_text text NOT NULL,
  status text NOT NULL, is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id), status text NOT NULL DEFAULT 'active', current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text,
  metadata_redacted jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_tenant_idx ON audit_logs(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email citext NOT NULL, role text NOT NULL CHECK (role IN ('manager','operator','customer')), token_hash bytea UNIQUE NOT NULL,
  invited_by uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,email)
);

INSERT INTO plans(code,name,account_limit,rule_limit,event_limit,price_uzs) VALUES
  ('free','Free',1,3,500,0), ('starter','Starter',3,20,10000,69000),
  ('pro','Pro',10,100,100000,199000), ('agency','Agency',50,1000,1000000,599000)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, account_limit=EXCLUDED.account_limit,
  rule_limit=EXCLUDED.rule_limit, event_limit=EXCLUDED.event_limit, price_uzs=EXCLUDED.price_uzs;

