-- Additive: old rules continue using their existing keywords and reply fields.
ALTER TABLE automation_rules ADD COLUMN combine_group_replies boolean NOT NULL DEFAULT false;
ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_tenant_key UNIQUE(workspace_id,id);
CREATE TABLE automation_keyword_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  priority integer NOT NULL DEFAULT 100 CHECK(priority BETWEEN 1 AND 1000),
  enabled boolean NOT NULL DEFAULT true,
  fuzzy_enabled boolean NOT NULL DEFAULT false,
  fuzzy_max_distance integer NOT NULL DEFAULT 1 CHECK(fuzzy_max_distance BETWEEN 0 AND 2),
  variables jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,automation_id) REFERENCES automation_rules(workspace_id,id) ON DELETE CASCADE,
  UNIQUE(workspace_id,automation_id,id)
);
CREATE INDEX keyword_groups_lookup_idx ON automation_keyword_groups(workspace_id,automation_id,priority);
CREATE TABLE automation_keyword_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  keyword_group_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('primary','synonym','typo')),
  text text NOT NULL CHECK(length(text) BETWEEN 1 AND 80),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,automation_id,keyword_group_id) REFERENCES automation_keyword_groups(workspace_id,automation_id,id) ON DELETE CASCADE
);
CREATE INDEX keyword_variants_lookup_idx ON automation_keyword_variants(workspace_id,automation_id,keyword_group_id);
CREATE TABLE automation_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  keyword_group_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN ('private','public')),
  text text NOT NULL CHECK(length(text)<=1000),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,automation_id,keyword_group_id) REFERENCES automation_keyword_groups(workspace_id,automation_id,id) ON DELETE CASCADE
);
CREATE INDEX reply_templates_lookup_idx ON automation_reply_templates(workspace_id,automation_id,keyword_group_id,channel);
ALTER TABLE automation_executions
  ADD COLUMN rule_snapshot jsonb,
  ADD COLUMN keyword_matches jsonb NOT NULL DEFAULT '[]';
-- Historical IDs deliberately survive template/group deletion.
ALTER TABLE automation_execution_actions ADD COLUMN template_ids text[] NOT NULL DEFAULT '{}';
