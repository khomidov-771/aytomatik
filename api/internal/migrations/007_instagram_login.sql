CREATE TABLE IF NOT EXISTS instagram_oauth_login_states (
  state_hash bytea PRIMARY KEY,
  browser_binding_hash bytea NOT NULL,
  remember_me boolean NOT NULL DEFAULT false,
  accept_terms boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instagram_oauth_login_states_expiry_idx
  ON instagram_oauth_login_states(expires_at);

CREATE TABLE IF NOT EXISTS instagram_oauth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK(provider IN ('meta')),
  instagram_user_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  terms_accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,instagram_user_id)
);
CREATE INDEX IF NOT EXISTS instagram_oauth_identities_user_idx
  ON instagram_oauth_identities(user_id);
