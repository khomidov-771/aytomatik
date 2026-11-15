package store

import (
	"context"
	"encoding/json"
)

func (s *Store) IsInstagramIdentity(ctx context.Context, userID, instagramID string) (bool, error) {
	var allowed bool
	err := s.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM instagram_oauth_identities WHERE user_id=$1 AND provider='meta' AND instagram_user_id=$2)`, userID, instagramID).Scan(&allowed)
	return allowed, err
}

// AdminRows returns only display data. Credentials and token ciphertext are
// deliberately omitted from every query.
func (s *Store) AdminRows(ctx context.Context, kind string, offset int) ([]json.RawMessage, error) {
	queries := map[string]string{
		"accounts":      `SELECT jsonb_build_object('id',a.id,'workspace',w.name,'username',a.username,'status',a.status,'account_type',a.account_type,'provider',a.provider,'scopes',a.scopes,'token_configured',a.token_ciphertext <> '','token_expires_at',a.token_expires_at,'connected_at',a.connected_at) FROM instagram_accounts a JOIN workspaces w ON w.id=a.workspace_id ORDER BY a.connected_at DESC,a.id LIMIT 100 OFFSET $1`,
		"rules":         `SELECT jsonb_build_object('id',r.id,'workspace',w.name,'account',a.username,'name',r.name,'active',r.is_active,'keywords',r.keywords,'groups',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',g.name,'keywords',COALESCE((SELECT jsonb_agg(v.text ORDER BY v.text) FROM automation_keyword_variants v WHERE v.keyword_group_id=g.id),'[]'::jsonb))) FROM automation_keyword_groups g WHERE g.automation_id=r.id),'[]'::jsonb)) FROM automation_rules r JOIN workspaces w ON w.id=r.workspace_id JOIN instagram_accounts a ON a.id=r.instagram_account_id ORDER BY r.created_at DESC,r.id LIMIT 100 OFFSET $1`,
		"conversations": `SELECT jsonb_build_object('id',c.id,'workspace',w.name,'account',a.username,'participant',c.participant_username,'last_message_at',c.last_message_at) FROM conversations c JOIN workspaces w ON w.id=c.workspace_id JOIN instagram_accounts a ON a.id=c.instagram_account_id ORDER BY c.last_message_at DESC,c.id LIMIT 100 OFFSET $1`,
	}
	query, ok := queries[kind]
	if !ok {
		return nil, ErrNotFound
	}
	rows, err := s.DB.Query(ctx, query, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []json.RawMessage{}
	for rows.Next() {
		var item json.RawMessage
		if err = rows.Scan(&item); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *Store) AdminMessages(ctx context.Context, id string, offset int) ([]Message, error) {
	var exists bool
	if err := s.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM conversations WHERE id=$1)`, id).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}
	rows, err := s.DB.Query(ctx, `SELECT id,direction,message_text,status,created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at,id LIMIT 100 OFFSET $2`, id, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Message{}
	for rows.Next() {
		var m Message
		if err = rows.Scan(&m.ID, &m.Direction, &m.Text, &m.Status, &m.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}
