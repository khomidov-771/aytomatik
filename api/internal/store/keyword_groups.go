package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/jackc/pgx/v5"
)

func saveRuleGroups(ctx context.Context, tx pgx.Tx, workspace string, rule *domain.AutomationRule) error {
	if _, err := tx.Exec(ctx, "UPDATE automation_rules SET combine_group_replies=$3 WHERE workspace_id=$1 AND id=$2", workspace, rule.ID, rule.CombineGroupReplies); err != nil {
		return err
	}
	groupIDs := []string{}
	for i := range rule.KeywordGroups {
		g := &rule.KeywordGroups[i]
		if g.Variables == nil {
			g.Variables = map[string]string{}
		}
		vars, _ := json.Marshal(g.Variables)
		err := tx.QueryRow(ctx, `INSERT INTO automation_keyword_groups(id,workspace_id,automation_id,name,priority,enabled,fuzzy_enabled,fuzzy_max_distance,variables)
			VALUES(COALESCE(NULLIF($1,'')::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,priority=EXCLUDED.priority,enabled=EXCLUDED.enabled,fuzzy_enabled=EXCLUDED.fuzzy_enabled,fuzzy_max_distance=EXCLUDED.fuzzy_max_distance,variables=EXCLUDED.variables,updated_at=now()
			WHERE automation_keyword_groups.workspace_id=EXCLUDED.workspace_id AND automation_keyword_groups.automation_id=EXCLUDED.automation_id RETURNING id`,
			g.ID, workspace, rule.ID, g.Name, g.Priority, g.Enabled, g.FuzzyEnabled, g.FuzzyMaxDistance, vars).Scan(&g.ID)
		if err == pgx.ErrNoRows {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		groupIDs = append(groupIDs, g.ID)
		variantIDs := []string{}
		for j := range g.Variants {
			v := &g.Variants[j]
			err = tx.QueryRow(ctx, `INSERT INTO automation_keyword_variants(id,workspace_id,automation_id,keyword_group_id,kind,text,enabled)
				VALUES(COALESCE(NULLIF($1,'')::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7)
				ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,text=EXCLUDED.text,enabled=EXCLUDED.enabled,updated_at=now()
				WHERE automation_keyword_variants.workspace_id=EXCLUDED.workspace_id AND automation_keyword_variants.automation_id=EXCLUDED.automation_id AND automation_keyword_variants.keyword_group_id=EXCLUDED.keyword_group_id RETURNING id`,
				v.ID, workspace, rule.ID, g.ID, v.Kind, v.Text, v.Enabled).Scan(&v.ID)
			if err == pgx.ErrNoRows {
				return ErrNotFound
			}
			if err != nil {
				return err
			}
			variantIDs = append(variantIDs, v.ID)
		}
		if _, err = tx.Exec(ctx, `DELETE FROM automation_keyword_variants WHERE workspace_id=$1 AND automation_id=$2 AND keyword_group_id=$3 AND NOT(id=ANY($4::uuid[]))`, workspace, rule.ID, g.ID, variantIDs); err != nil {
			return err
		}
		templateIDs := []string{}
		for channel, templates := range map[string][]domain.ReplyTemplate{"private": g.DMTemplates, "public": g.PublicTemplates} {
			for j := range templates {
				t := &templates[j]
				err = tx.QueryRow(ctx, `INSERT INTO automation_reply_templates(id,workspace_id,automation_id,keyword_group_id,channel,text,enabled)
					VALUES(COALESCE(NULLIF($1,'')::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7)
					ON CONFLICT(id) DO UPDATE SET text=EXCLUDED.text,enabled=EXCLUDED.enabled,updated_at=now()
					WHERE automation_reply_templates.workspace_id=EXCLUDED.workspace_id AND automation_reply_templates.automation_id=EXCLUDED.automation_id AND automation_reply_templates.keyword_group_id=EXCLUDED.keyword_group_id AND automation_reply_templates.channel=EXCLUDED.channel RETURNING id`,
					t.ID, workspace, rule.ID, g.ID, channel, t.Text, t.Enabled).Scan(&t.ID)
				if err == pgx.ErrNoRows {
					return ErrNotFound
				}
				if err != nil {
					return err
				}
				templateIDs = append(templateIDs, t.ID)
			}
		}
		if _, err = tx.Exec(ctx, `DELETE FROM automation_reply_templates WHERE workspace_id=$1 AND automation_id=$2 AND keyword_group_id=$3 AND NOT(id=ANY($4::uuid[]))`, workspace, rule.ID, g.ID, templateIDs); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `DELETE FROM automation_keyword_groups WHERE workspace_id=$1 AND automation_id=$2 AND NOT(id=ANY($3::uuid[]))`, workspace, rule.ID, groupIDs)
	return err
}

var ErrInvalidRule = errors.New("invalid automation")
var ErrRuleConflict = errors.New("automation changed, reload before saving")

func previousVersion(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return t
}

// One statement provides a consistent rule and group snapshot. Candidate and
// listing queries never fetch template text. Only the selected rule needs it.
func (s *Store) readRules(ctx context.Context, workspace string, withTemplates bool, filter string, args []any) ([]domain.AutomationRule, error) {
	const query = `SELECT r.id,r.instagram_account_id,a.username,r.name,r.trigger_type,r.match_mode,r.keywords,r.exclusions,r.media_scope,r.media_ids,r.private_reply_text,r.public_success_reply_text,r.public_not_follower_reply_text,r.public_unknown_reply_text,r.follow_verification_enabled,r.unknown_fallback_policy,r.is_active,r.priority,r.created_at,r.updated_at,r.combine_group_replies,
	COALESCE((
		SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'priority',g.priority,'enabled',g.enabled,'fuzzy_enabled',g.fuzzy_enabled,'fuzzy_max_distance',g.fuzzy_max_distance,'variables',g.variables,
			'variants',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'kind',v.kind,'text',v.text,'enabled',v.enabled) ORDER BY v.created_at,v.id) FROM automation_keyword_variants v WHERE v.workspace_id=g.workspace_id AND v.automation_id=g.automation_id AND v.keyword_group_id=g.id),'[]'),
			'dm_templates',CASE WHEN $2::boolean THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'text',t.text,'enabled',t.enabled) ORDER BY t.created_at,t.id) FROM automation_reply_templates t WHERE t.workspace_id=g.workspace_id AND t.automation_id=g.automation_id AND t.keyword_group_id=g.id AND t.channel='private'),'[]') ELSE '[]'::jsonb END,
			'public_templates',CASE WHEN $2::boolean THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'text',t.text,'enabled',t.enabled) ORDER BY t.created_at,t.id) FROM automation_reply_templates t WHERE t.workspace_id=g.workspace_id AND t.automation_id=g.automation_id AND t.keyword_group_id=g.id AND t.channel='public'),'[]') ELSE '[]'::jsonb END
		) ORDER BY g.priority,g.created_at,g.id) FROM automation_keyword_groups g WHERE g.workspace_id=r.workspace_id AND g.automation_id=r.id),'[]')
	FROM automation_rules r JOIN instagram_accounts a ON a.id=r.instagram_account_id AND a.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND a.provider<>'mock'`
	rows, err := s.DB.Query(ctx, query+filter, append([]any{workspace, withTemplates}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.AutomationRule{}
	for rows.Next() {
		var r domain.AutomationRule
		if err = rows.Scan(&r.ID, &r.InstagramAccountID, &r.AccountUsername, &r.Name, &r.TriggerType, &r.MatchMode, &r.Keywords, &r.Exclusions, &r.MediaScope, &r.MediaIDs, &r.PrivateReplyText, &r.PublicSuccessReplyText, &r.PublicNotFollowerReplyText, &r.PublicUnknownReplyText, &r.FollowVerificationEnabled, &r.UnknownFallbackPolicy, &r.IsActive, &r.Priority, &r.CreatedAt, &r.UpdatedAt, &r.CombineGroupReplies, &r.KeywordGroups); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

type ExecutionPlan struct {
	ID           string
	RuleID       string
	Rule         *domain.AutomationRule
	Matches      []domain.KeywordMatch
	FollowStatus domain.FollowerStatus
}

func (s *Store) ExecutionPlan(ctx context.Context, workspace, eventID string) (ExecutionPlan, error) {
	var p ExecutionPlan
	var raw, matchRaw []byte
	err := s.DB.QueryRow(ctx, `SELECT id,COALESCE(rule_id::text,''),rule_snapshot,keyword_matches,follow_status FROM automation_executions WHERE workspace_id=$1 AND event_id=$2`, workspace, eventID).Scan(&p.ID, &p.RuleID, &raw, &matchRaw, &p.FollowStatus)
	if err == pgx.ErrNoRows {
		return p, ErrNotFound
	}
	if err != nil {
		return p, err
	}
	if len(raw) > 0 {
		if err = json.Unmarshal(raw, &p.Rule); err != nil {
			return p, err
		}
	}
	if err = json.Unmarshal(matchRaw, &p.Matches); err != nil {
		return p, err
	}
	return p, nil
}

func (s *Store) SaveExecutionPlan(ctx context.Context, workspace, eventID string, rule domain.AutomationRule, matches []domain.KeywordMatch) (ExecutionPlan, error) {
	id, _, err := s.EnsureExecution(ctx, eventID, workspace, rule.ID)
	if err != nil {
		return ExecutionPlan{}, err
	}
	raw, _ := json.Marshal(rule)
	matchRaw, _ := json.Marshal(matches)
	_, err = s.DB.Exec(ctx, `UPDATE automation_executions SET rule_snapshot=$3,keyword_matches=$4 WHERE workspace_id=$1 AND id=$2 AND rule_id=$5 AND rule_snapshot IS NULL`, workspace, id, raw, matchRaw, rule.ID)
	if err != nil {
		return ExecutionPlan{}, err
	}
	return s.ExecutionPlan(ctx, workspace, eventID)
}
