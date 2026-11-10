CREATE TABLE IF NOT EXISTS google_oauth_login_states (
  state_hash bytea PRIMARY KEY,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  intent text NOT NULL CHECK (intent IN ('login','register')),
  accept_terms boolean NOT NULL DEFAULT false,
  remember_me boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_oauth_login_states_expiry_idx ON google_oauth_login_states(expires_at);

CREATE TABLE IF NOT EXISTS oauth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'google'),
  provider_subject text NOT NULL,
  email_at_link citext NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS oauth_identities_user_idx ON oauth_identities(user_id);
