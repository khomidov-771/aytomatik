export type User = { user_id: string; name: string; email: string; workspace_id: string; workspace_name: string; role: "owner" | "manager" | "operator" | "customer"; csrf_token: string };
export type Session = { user: User; csrf_token: string; instagram_provider: "mock" | "meta"; demo_mode: boolean };
export type InstagramAccount = { id: string; instagram_user_id: string; username: string; account_type: string; avatar_url?: string; status: string; provider: string; scopes: string[]; token_expires_at?: string; connected_at: string; last_sync_at?: string };
export type Automation = { id: string; instagram_account_id: string; account_username?: string; name: string; trigger_type: string; match_mode: "exact" | "contains" | "keyword_list"; keywords: string[]; exclusions: string[]; media_scope: "all" | "selected"; media_ids: string[]; reply_text: string; is_active: boolean; priority: number; created_at: string; updated_at: string };
export type Metrics = { comments: number; eligible_triggers: number; replies_sent: number; failures: number; conversion: number; series: { label: string; comments: number; replies: number }[] };
export type Conversation = { id: string; account_username: string; participant_username: string; status: string; unread_count: number; can_reply_until?: string; last_message_at: string; last_message: string };
export type Message = { id: string; direction: "inbound" | "outbound"; text: string; status: string; is_demo: boolean; created_at: string };
export type Plan = { code: string; name: string; status: string; account_limit: number; rule_limit: number; event_limit: number; price_uzs: number; accounts_used: number; rules_used: number; period_end: string };
export type Member = { id: string; name: string; email: string; role: string; created_at: string };

