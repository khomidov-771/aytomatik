package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")
var ErrLimit = errors.New("plan limit reached")
var ErrAccountClaimed = errors.New("provider account is already connected to another workspace")
var ErrEmailUnverified = errors.New("email is not verified")
var ErrOwnerProtected = errors.New("workspace owner membership is protected")
var ErrSelfRemoval = errors.New("the active owner cannot remove their own membership")
var ErrInvalidRole = errors.New("invalid role")

type Store struct{ DB *pgxpool.Pool }

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err = pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{DB: pool}, nil
}

func (s *Store) Register(ctx context.Context, name, email, passwordHash string) (domain.Principal, string, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return domain.Principal{}, "", err
	}
	defer tx.Rollback(ctx)
	var userID, workspaceID string
	email = strings.ToLower(strings.TrimSpace(email))
	err = tx.QueryRow(ctx, `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id`, name, email, passwordHash).Scan(&userID)
	if err != nil {
		return domain.Principal{}, "", err
	}
	workspaceName := strings.TrimSpace(name) + " workspace"
	err = tx.QueryRow(ctx, `INSERT INTO workspaces(name,owner_user_id,plan_id) SELECT $1,$2,id FROM plans WHERE code='free' RETURNING id`, workspaceName, userID).Scan(&workspaceID)
	if err != nil {
		return domain.Principal{}, "", err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')`, workspaceID, userID); err != nil {
		return domain.Principal{}, "", err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO subscriptions(workspace_id,plan_id) SELECT $1,id FROM plans WHERE code='free'`, workspaceID); err != nil {
		return domain.Principal{}, "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.Principal{}, "", err
	}
	return domain.Principal{UserID: userID, Name: name, Email: email, WorkspaceID: workspaceID, Workspace: workspaceName, Role: "owner"}, userID, nil
}

func (s *Store) LoginUser(ctx context.Context, email string) (id, name, normalizedEmail, passwordHash, workspaceID, workspaceName, role string, verified bool, err error) {
	err = s.DB.QueryRow(ctx, `SELECT u.id,u.name,u.email,u.password_hash,w.id,w.name,wm.role,u.email_verified_at IS NOT NULL
		FROM users u JOIN workspace_members wm ON wm.user_id=u.id JOIN workspaces w ON w.id=wm.workspace_id
		WHERE u.email=$1 ORDER BY CASE wm.role WHEN 'owner' THEN 1 ELSE 2 END LIMIT 1`, strings.ToLower(strings.TrimSpace(email))).
		Scan(&id, &name, &normalizedEmail, &passwordHash, &workspaceID, &workspaceName, &role, &verified)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

func (s *Store) CreateSession(ctx context.Context, principal domain.Principal, tokenHash []byte, csrf string, expires time.Time) error {
	return s.DB.QueryRow(ctx, `INSERT INTO sessions(user_id,workspace_id,token_hash,csrf_token,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING id`,
		principal.UserID, principal.WorkspaceID, tokenHash, csrf, expires).Scan(&principal.SessionID)
}

func (s *Store) PrincipalBySession(ctx context.Context, tokenHash []byte) (domain.Principal, error) {
	var p domain.Principal
	var verified bool
	err := s.DB.QueryRow(ctx, `SELECT u.id,u.name,u.email,w.id,w.name,wm.role,s.id,s.expires_at,s.csrf_token,u.email_verified_at IS NOT NULL
		FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspaces w ON w.id=s.workspace_id
		JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=u.id
		WHERE s.token_hash=$1 AND s.expires_at>now()`, tokenHash).
		Scan(&p.UserID, &p.Name, &p.Email, &p.WorkspaceID, &p.Workspace, &p.Role, &p.SessionID, &p.SessionExpiresAt, &p.CSRFToken, &verified)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, ErrNotFound
	}
	if err == nil && !verified {
		return p, ErrEmailUnverified
	}
	if err == nil {
		_, _ = s.DB.Exec(ctx, `UPDATE sessions SET last_seen_at=now() WHERE id=$1 AND last_seen_at<now()-interval '5 minutes'`, p.SessionID)
	}
	return p, err
}

func (s *Store) DeleteSession(ctx context.Context, sessionID, userID string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM sessions WHERE id=$1 AND user_id=$2`, sessionID, userID)
	return err
}

type SessionInfo struct {
	ID            string    `json:"id"`
	WorkspaceName string    `json:"workspace_name"`
	Current       bool      `json:"current"`
	LastSeenAt    time.Time `json:"last_seen_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	CreatedAt     time.Time `json:"created_at"`
}

func (s *Store) UserSessions(ctx context.Context, userID, currentSessionID string) ([]SessionInfo, error) {
	rows, err := s.DB.Query(ctx, `SELECT s.id,w.name,s.id=$2,s.last_seen_at,s.expires_at,s.created_at FROM sessions s JOIN workspaces w ON w.id=s.workspace_id WHERE s.user_id=$1 AND s.expires_at>now() ORDER BY s.last_seen_at DESC`, userID, currentSessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []SessionInfo{}
	for rows.Next() {
		var item SessionInfo
		if err = rows.Scan(&item.ID, &item.WorkspaceName, &item.Current, &item.LastSeenAt, &item.ExpiresAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) RevokeSession(ctx context.Context, userID, sessionID string) error {
	tag, err := s.DB.Exec(ctx, `DELETE FROM sessions WHERE user_id=$1 AND id=$2`, userID, sessionID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type WorkspaceMembership struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}

func (s *Store) UserWorkspaces(ctx context.Context, userID string) ([]WorkspaceMembership, error) {
	rows, err := s.DB.Query(ctx, `SELECT w.id,w.name,wm.role FROM workspace_members wm JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.user_id=$1 ORDER BY w.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []WorkspaceMembership{}
	for rows.Next() {
		var item WorkspaceMembership
		if err = rows.Scan(&item.ID, &item.Name, &item.Role); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// SwitchWorkspace validates membership and rotates the entire session instead
// of mutating tenant context in place.
func (s *Store) SwitchWorkspace(ctx context.Context, currentSessionID, userID, workspaceID string, tokenHash []byte, csrf string, expires time.Time) (domain.Principal, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return domain.Principal{}, err
	}
	defer tx.Rollback(ctx)
	var p domain.Principal
	err = tx.QueryRow(ctx, `SELECT u.id,u.name,u.email,w.id,w.name,wm.role FROM users u JOIN workspace_members wm ON wm.user_id=u.id JOIN workspaces w ON w.id=wm.workspace_id WHERE u.id=$1 AND w.id=$2`, userID, workspaceID).
		Scan(&p.UserID, &p.Name, &p.Email, &p.WorkspaceID, &p.Workspace, &p.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, ErrNotFound
	}
	if err != nil {
		return p, err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM sessions WHERE id=$1 AND user_id=$2`, currentSessionID, userID); err != nil {
		return p, err
	}
	err = tx.QueryRow(ctx, `INSERT INTO sessions(user_id,workspace_id,token_hash,csrf_token,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING id`, userID, workspaceID, tokenHash, csrf, expires).Scan(&p.SessionID)
	if err != nil {
		return p, err
	}
	p.CSRFToken = csrf
	p.SessionExpiresAt = expires
	if err = tx.Commit(ctx); err != nil {
		return p, err
	}
	return p, nil
}

func (s *Store) CreateOneTimeToken(ctx context.Context, email, purpose string, tokenHash []byte, expires time.Time) (bool, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	email = strings.ToLower(strings.TrimSpace(email))
	if _, err = tx.Exec(ctx, `UPDATE one_time_tokens SET used_at=now() WHERE user_id=(SELECT id FROM users WHERE email=$1) AND purpose=$2 AND used_at IS NULL`, email, purpose); err != nil {
		return false, err
	}
	var inserted bool
	err = tx.QueryRow(ctx, `INSERT INTO one_time_tokens(user_id,purpose,token_hash,expires_at)
		SELECT id,$2,$3,$4 FROM users WHERE email=$1 AND ($2<>'email_verify' OR email_verified_at IS NULL) RETURNING true`, email, purpose, tokenHash, expires).Scan(&inserted)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, tx.Commit(ctx)
	}
	if err != nil {
		return false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return false, err
	}
	return inserted, nil
}

func (s *Store) VerifyEmail(ctx context.Context, tokenHash []byte) error {
	tag, err := s.DB.Exec(ctx, `WITH used AS (UPDATE one_time_tokens SET used_at=now() WHERE token_hash=$1 AND purpose='email_verify' AND used_at IS NULL AND expires_at>now() RETURNING user_id)
		UPDATE users SET email_verified_at=now() WHERE id IN (SELECT user_id FROM used)`, tokenHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ResetPassword(ctx context.Context, tokenHash []byte, passwordHash string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var userID string
	err = tx.QueryRow(ctx, `UPDATE one_time_tokens SET used_at=now() WHERE token_hash=$1 AND purpose='password_reset' AND used_at IS NULL AND expires_at>now() RETURNING user_id`, tokenHash).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2`, passwordHash, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM sessions WHERE user_id=$1`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) SaveOAuthState(ctx context.Context, p domain.Principal, hash []byte, expires time.Time) error {
	_, err := s.DB.Exec(ctx, `INSERT INTO oauth_states(workspace_id,user_id,state_hash,expires_at) VALUES($1,$2,$3,$4)`, p.WorkspaceID, p.UserID, hash, expires)
	return err
}

func (s *Store) ConsumeOAuthState(ctx context.Context, hash []byte) (workspaceID, userID string, err error) {
	err = s.DB.QueryRow(ctx, `UPDATE oauth_states SET used_at=now() WHERE state_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING workspace_id,user_id`, hash).Scan(&workspaceID, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

type AccountInput struct {
	InstagramUserID, Username, AccountType, AvatarURL, TokenCiphertext, Provider string
	Scopes                                                                       []string
	TokenExpiresAt                                                               *time.Time
}

func (s *Store) UpsertInstagramAccount(ctx context.Context, workspaceID, userID string, in AccountInput) error {
	if in.Scopes == nil {
		in.Scopes = []string{}
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var limit int
	if err = tx.QueryRow(ctx, `SELECT p.account_limit FROM workspaces w JOIN plans p ON p.id=w.plan_id WHERE w.id=$1 FOR UPDATE OF w`, workspaceID).Scan(&limit); err != nil {
		return err
	}
	var count int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM instagram_accounts WHERE workspace_id=$1 AND status='connected'`, workspaceID).Scan(&count); err != nil {
		return err
	}
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM instagram_accounts WHERE workspace_id=$1 AND instagram_user_id=$2)`, workspaceID, in.InstagramUserID).Scan(&exists); err != nil {
		return err
	}
	if !exists && count >= limit {
		return ErrLimit
	}
	_, err = tx.Exec(ctx, `INSERT INTO instagram_accounts(workspace_id,instagram_user_id,username,account_type,avatar_url,token_ciphertext,token_expires_at,scopes,status,provider,connected_by,last_sync_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,'connected',$9,$10,now()) ON CONFLICT(workspace_id,instagram_user_id) DO UPDATE SET username=EXCLUDED.username,account_type=EXCLUDED.account_type,avatar_url=EXCLUDED.avatar_url,token_ciphertext=EXCLUDED.token_ciphertext,token_expires_at=EXCLUDED.token_expires_at,scopes=EXCLUDED.scopes,status='connected',provider=EXCLUDED.provider,connected_by=EXCLUDED.connected_by,last_sync_at=now()`, workspaceID, in.InstagramUserID, in.Username, in.AccountType, in.AvatarURL, in.TokenCiphertext, in.TokenExpiresAt, in.Scopes, in.Provider, userID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "instagram_accounts_active_provider_uidx" {
		return ErrAccountClaimed
	}
	if err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	_ = s.Audit(ctx, workspaceID, userID, "instagram.connected", "instagram_account", in.InstagramUserID, map[string]any{"provider": in.Provider})
	return nil
}

func (s *Store) ListInstagramAccounts(ctx context.Context, workspaceID string) ([]domain.InstagramAccount, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,instagram_user_id,username,account_type,COALESCE(avatar_url,''),status,provider,scopes,token_expires_at,connected_at,last_sync_at FROM instagram_accounts WHERE workspace_id=$1 ORDER BY connected_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.InstagramAccount{}
	for rows.Next() {
		var a domain.InstagramAccount
		if err = rows.Scan(&a.ID, &a.InstagramUserID, &a.Username, &a.AccountType, &a.AvatarURL, &a.Status, &a.Provider, &a.Scopes, &a.TokenExpiresAt, &a.ConnectedAt, &a.LastSyncAt); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, rows.Err()
}

func (s *Store) DisconnectInstagramAccount(ctx context.Context, workspaceID, userID, id string) error {
	tag, err := s.DB.Exec(ctx, `UPDATE instagram_accounts SET status='disconnected',token_ciphertext='' WHERE id=$1 AND workspace_id=$2`, id, workspaceID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	_ = s.Audit(ctx, workspaceID, userID, "instagram.disconnected", "instagram_account", id, nil)
	return nil
}

func (s *Store) AccountSecretByProviderID(ctx context.Context, provider, providerAccountID string) (id, workspaceID, tokenCiphertext string, err error) {
	err = s.DB.QueryRow(ctx, `SELECT id,workspace_id,token_ciphertext FROM instagram_accounts WHERE provider=$1 AND instagram_user_id=$2 AND status='connected'`, provider, providerAccountID).Scan(&id, &workspaceID, &tokenCiphertext)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

func (s *Store) AccountSecretByID(ctx context.Context, workspaceID, id string) (providerAccountID, tokenCiphertext, provider string, err error) {
	err = s.DB.QueryRow(ctx, `SELECT instagram_user_id,token_ciphertext,provider FROM instagram_accounts WHERE id=$1 AND workspace_id=$2 AND status='connected'`, id, workspaceID).Scan(&providerAccountID, &tokenCiphertext, &provider)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

func normalizeRule(r domain.AutomationRule) (domain.AutomationRule, error) {
	r.Name = strings.TrimSpace(r.Name)
	r.ReplyText = strings.TrimSpace(r.ReplyText)
	if utf8.RuneCountInString(r.Name) < 2 || utf8.RuneCountInString(r.Name) > 100 || len(r.Keywords) == 0 || r.ReplyText == "" {
		return r, errors.New("name must be 2-100 characters; keywords and reply text are required")
	}
	if r.MatchMode != "exact" && r.MatchMode != "contains" && r.MatchMode != "keyword_list" {
		return r, errors.New("invalid match mode")
	}
	if utf8.RuneCountInString(r.ReplyText) > 1000 {
		return r, errors.New("reply text is too long")
	}
	if len(r.Keywords) > 20 || len(r.Exclusions) > 20 {
		return r, errors.New("too many keywords or exclusions")
	}
	for _, value := range append(append([]string{}, r.Keywords...), r.Exclusions...) {
		if utf8.RuneCountInString(strings.TrimSpace(value)) > 80 {
			return r, errors.New("keyword or exclusion is too long")
		}
	}
	r.Keywords = cleanRuleList(r.Keywords, 80)
	r.Exclusions = cleanRuleList(r.Exclusions, 80)
	if len(r.Keywords) == 0 {
		return r, errors.New("keywords are required")
	}
	if r.MediaScope != "all" && r.MediaScope != "selected" {
		return r, errors.New("invalid media scope")
	}
	if r.MediaScope == "all" {
		r.MediaIDs = []string{}
	} else {
		if len(r.MediaIDs) == 0 || len(r.MediaIDs) > 50 {
			return r, errors.New("selected media IDs are required and limited to 50")
		}
		for _, value := range r.MediaIDs {
			if utf8.RuneCountInString(strings.TrimSpace(value)) > 128 {
				return r, errors.New("media ID is too long")
			}
		}
		r.MediaIDs = cleanRuleList(r.MediaIDs, 128)
		if len(r.MediaIDs) == 0 {
			return r, errors.New("selected media IDs are required")
		}
	}
	if r.Priority < 1 || r.Priority > 1000 {
		return r, errors.New("invalid priority")
	}
	return r, nil
}

func cleanRuleList(values []string, maxRunes int) []string {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := strings.ToLower(value)
		if value == "" || utf8.RuneCountInString(value) > maxRunes || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, value)
	}
	return result
}

func (s *Store) CreateRule(ctx context.Context, p domain.Principal, r domain.AutomationRule) (domain.AutomationRule, error) {
	var err error
	if r, err = normalizeRule(r); err != nil {
		return r, err
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return r, err
	}
	defer tx.Rollback(ctx)
	var limit int
	if err = tx.QueryRow(ctx, `SELECT p.rule_limit FROM workspaces w JOIN plans p ON p.id=w.plan_id WHERE w.id=$1 FOR UPDATE OF w`, p.WorkspaceID).Scan(&limit); err != nil {
		return r, err
	}
	var count int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM automation_rules WHERE workspace_id=$1`, p.WorkspaceID).Scan(&count); err != nil {
		return r, err
	}
	if count >= limit {
		return r, ErrLimit
	}
	err = tx.QueryRow(ctx, `INSERT INTO automation_rules(workspace_id,instagram_account_id,name,trigger_type,match_mode,keywords,exclusions,media_scope,media_ids,reply_text,is_active,priority)
		SELECT $1,a.id,$3,'comment_created',$4,$5,$6,$7,$8,$9,$10,$11 FROM instagram_accounts a WHERE a.id=$2 AND a.workspace_id=$1 AND a.status='connected' RETURNING id,created_at,updated_at`, p.WorkspaceID, r.InstagramAccountID, r.Name, r.MatchMode, r.Keywords, r.Exclusions, r.MediaScope, r.MediaIDs, r.ReplyText, r.IsActive, r.Priority).Scan(&r.ID, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	if err = tx.Commit(ctx); err != nil {
		return r, err
	}
	_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "automation.created", "automation_rule", r.ID, nil)
	return r, nil
}

func (s *Store) ListRules(ctx context.Context, workspaceID string) ([]domain.AutomationRule, error) {
	rows, err := s.DB.Query(ctx, `SELECT r.id,r.instagram_account_id,a.username,r.name,r.trigger_type,r.match_mode,r.keywords,r.exclusions,r.media_scope,r.media_ids,r.reply_text,r.is_active,r.priority,r.created_at,r.updated_at FROM automation_rules r JOIN instagram_accounts a ON a.id=r.instagram_account_id WHERE r.workspace_id=$1 ORDER BY r.priority,r.created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.AutomationRule{}
	for rows.Next() {
		var r domain.AutomationRule
		if err = rows.Scan(&r.ID, &r.InstagramAccountID, &r.AccountUsername, &r.Name, &r.TriggerType, &r.MatchMode, &r.Keywords, &r.Exclusions, &r.MediaScope, &r.MediaIDs, &r.ReplyText, &r.IsActive, &r.Priority, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (s *Store) GetRule(ctx context.Context, workspaceID, id string) (domain.AutomationRule, error) {
	var r domain.AutomationRule
	err := s.DB.QueryRow(ctx, `SELECT r.id,r.instagram_account_id,a.username,r.name,r.trigger_type,r.match_mode,r.keywords,r.exclusions,r.media_scope,r.media_ids,r.reply_text,r.is_active,r.priority,r.created_at,r.updated_at FROM automation_rules r JOIN instagram_accounts a ON a.id=r.instagram_account_id WHERE r.workspace_id=$1 AND r.id=$2`, workspaceID, id).Scan(&r.ID, &r.InstagramAccountID, &r.AccountUsername, &r.Name, &r.TriggerType, &r.MatchMode, &r.Keywords, &r.Exclusions, &r.MediaScope, &r.MediaIDs, &r.ReplyText, &r.IsActive, &r.Priority, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return r, err
}

func (s *Store) UpdateRule(ctx context.Context, p domain.Principal, r domain.AutomationRule) (domain.AutomationRule, error) {
	var err error
	if r, err = normalizeRule(r); err != nil {
		return r, err
	}
	err = s.DB.QueryRow(ctx, `UPDATE automation_rules SET name=$3,match_mode=$4,keywords=$5,exclusions=$6,media_scope=$7,media_ids=$8,reply_text=$9,is_active=$10,priority=$11,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING updated_at`, p.WorkspaceID, r.ID, r.Name, r.MatchMode, r.Keywords, r.Exclusions, r.MediaScope, r.MediaIDs, r.ReplyText, r.IsActive, r.Priority).Scan(&r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNotFound
	}
	if err == nil {
		_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "automation.updated", "automation_rule", r.ID, nil)
	}
	return r, err
}

func (s *Store) DeleteRule(ctx context.Context, p domain.Principal, id string) error {
	tag, err := s.DB.Exec(ctx, `DELETE FROM automation_rules WHERE workspace_id=$1 AND id=$2`, p.WorkspaceID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "automation.deleted", "automation_rule", id, nil)
	return nil
}

func (s *Store) ActiveRules(ctx context.Context, workspaceID, accountID string) ([]domain.AutomationRule, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,instagram_account_id,name,trigger_type,match_mode,keywords,exclusions,media_scope,media_ids,reply_text,is_active,priority,created_at,updated_at FROM automation_rules WHERE workspace_id=$1 AND instagram_account_id=$2 AND is_active=true ORDER BY priority,created_at`, workspaceID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.AutomationRule{}
	for rows.Next() {
		var r domain.AutomationRule
		if err = rows.Scan(&r.ID, &r.InstagramAccountID, &r.Name, &r.TriggerType, &r.MatchMode, &r.Keywords, &r.Exclusions, &r.MediaScope, &r.MediaIDs, &r.ReplyText, &r.IsActive, &r.Priority, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (s *Store) EnqueueEvent(ctx context.Context, provider string, event domain.CommentEvent) (eventID, workspaceID, accountID string, inserted bool, err error) {
	accountID, workspaceID, _, err = s.AccountSecretByProviderID(ctx, provider, event.AccountID)
	if err != nil {
		return
	}
	payload, _ := json.Marshal(map[string]any{"comment_id": event.CommentID, "media_id": event.MediaID, "text": event.Text, "username": event.Username, "participant_id": event.ParticipantID, "created_at": event.CreatedAt, "is_live": event.IsLive})
	err = s.DB.QueryRow(ctx, `INSERT INTO webhook_events(provider_event_id,workspace_id,instagram_account_id,event_type,payload_redacted) VALUES($1,$2,$3,'comment_created',$4) ON CONFLICT(provider_event_id) DO NOTHING RETURNING id`, event.ProviderEventID, workspaceID, accountID, payload).Scan(&eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
		return "", workspaceID, accountID, false, nil
	}
	inserted = err == nil
	return
}

type QueuedCommentEvent struct {
	EventID      string
	WorkspaceID  string
	AccountID    string
	AttemptCount int
	Event        domain.CommentEvent
}

// ClaimQueuedEvent leases one due comment event. An empty eventID claims the
// oldest due event, which lets workers recover jobs after process/Redis loss.
func (s *Store) ClaimQueuedEvent(ctx context.Context, eventID string, maxAttempts int) (QueuedCommentEvent, error) {
	var queued QueuedCommentEvent
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return queued, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE webhook_events SET processing_status='failed',error_code='retry_exhausted',processed_at=now(),leased_at=NULL
		WHERE event_type='comment_created' AND processing_status IN ('queued','processing') AND attempt_count >= $1
		AND (processing_status='queued' OR leased_at < now()-interval '2 minutes')`, maxAttempts)
	if err != nil {
		return queued, err
	}
	var payload []byte
	var providerEventID, providerAccountID string
	err = tx.QueryRow(ctx, `SELECT w.id,w.workspace_id,w.instagram_account_id,w.provider_event_id,w.payload_redacted,w.attempt_count,a.instagram_user_id
		FROM webhook_events w JOIN instagram_accounts a ON a.id=w.instagram_account_id
		WHERE w.event_type='comment_created' AND w.attempt_count < $2 AND ($1='' OR w.id::text=$1)
		AND ((w.processing_status='queued' AND w.next_attempt_at<=now())
			OR (w.processing_status='processing' AND w.leased_at<now()-interval '2 minutes'))
		ORDER BY w.received_at FOR UPDATE OF w SKIP LOCKED LIMIT 1`, eventID, maxAttempts).Scan(
		&queued.EventID, &queued.WorkspaceID, &queued.AccountID, &providerEventID, &payload, &queued.AttemptCount, &providerAccountID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return queued, ErrNotFound
	}
	if err != nil {
		return queued, err
	}
	if err = json.Unmarshal(payload, &queued.Event); err != nil {
		_, _ = tx.Exec(ctx, `UPDATE webhook_events SET processing_status='failed',error_code='invalid_stored_payload',processed_at=now(),leased_at=NULL WHERE id=$1`, queued.EventID)
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return queued, commitErr
		}
		return queued, errors.New("invalid stored webhook payload")
	}
	// These routing/idempotency fields come from trusted relational columns,
	// never from the redacted JSON payload.
	queued.Event.ProviderEventID = providerEventID
	queued.Event.AccountID = providerAccountID
	queued.AttemptCount++
	_, err = tx.Exec(ctx, `UPDATE webhook_events SET processing_status='processing',leased_at=now(),attempt_count=attempt_count+1,error_code=NULL WHERE id=$1`, queued.EventID)
	if err != nil {
		return queued, err
	}
	if err = tx.Commit(ctx); err != nil {
		return queued, err
	}
	return queued, nil
}

func (s *Store) RetryEvent(ctx context.Context, eventID, workspaceID, errorCode string, delay time.Duration) error {
	tag, err := s.DB.Exec(ctx, `UPDATE webhook_events SET processing_status='queued',error_code=$3,next_attempt_at=now()+make_interval(secs => $4),leased_at=NULL
		WHERE id=$1 AND workspace_id=$2 AND processing_status='processing'`, eventID, workspaceID, errorCode, delay.Seconds())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// BeginDelivery is the fail-closed boundary before an external provider call.
// If a worker crashes after this marker is committed, recovery will not send a
// second private reply for the same event.
func (s *Store) BeginDelivery(ctx context.Context, eventID, workspaceID, ruleID string) (bool, error) {
	var executionID string
	err := s.DB.QueryRow(ctx, `INSERT INTO automation_executions(workspace_id,rule_id,event_id,status)
		SELECT $1,r.id,w.id,'sending' FROM webhook_events w JOIN automation_rules r ON r.id=$2 AND r.workspace_id=$1
		WHERE w.id=$3 AND w.workspace_id=$1
		ON CONFLICT(event_id) DO NOTHING RETURNING id`, workspaceID, ruleID, eventID).Scan(&executionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// RecordInboundMessage stores a verified provider message idempotently and
// opens (or extends) the manual reply window. No other event type may update
// can_reply_until.
func (s *Store) RecordInboundMessage(ctx context.Context, provider string, event domain.InboundMessageEvent, isDemo bool) (workspaceID, accountID string, inserted bool, err error) {
	accountID, workspaceID, _, err = s.AccountSecretByProviderID(ctx, provider, event.AccountID)
	if err != nil {
		return
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return workspaceID, accountID, false, err
	}
	defer tx.Rollback(ctx)
	username := strings.TrimSpace(event.Username)
	if username == "" {
		username = event.ParticipantID
	}
	var conversationID string
	err = tx.QueryRow(ctx, `INSERT INTO conversations(workspace_id,instagram_account_id,participant_id,participant_username,last_message_at)
		VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,instagram_account_id,participant_id) DO UPDATE SET participant_username=EXCLUDED.participant_username RETURNING id`, workspaceID, accountID, event.ParticipantID, username, event.CreatedAt).Scan(&conversationID)
	if err != nil {
		return workspaceID, accountID, false, err
	}
	var messageID string
	err = tx.QueryRow(ctx, `INSERT INTO messages(conversation_id,provider_message_id,direction,message_text,status,is_demo,created_at)
		VALUES($1,$2,'inbound',$3,'received',$4,$5)
		ON CONFLICT(provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING RETURNING id`, conversationID, event.ProviderMessageID, event.Text, isDemo, event.CreatedAt).Scan(&messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return workspaceID, accountID, false, nil
	}
	if err != nil {
		return workspaceID, accountID, false, err
	}
	_, err = tx.Exec(ctx, `UPDATE conversations
		SET can_reply_until=CASE WHEN can_reply_until IS NULL OR can_reply_until < $2 THEN $2 ELSE can_reply_until END,
			last_message_at=$3,unread_count=unread_count+1
		WHERE id=$1`, conversationID, event.CreatedAt.Add(24*time.Hour), event.CreatedAt)
	if err != nil {
		return workspaceID, accountID, false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return workspaceID, accountID, false, err
	}
	return workspaceID, accountID, true, nil
}

func (s *Store) CompleteExecution(ctx context.Context, eventID, workspaceID string, rule *domain.AutomationRule, event domain.CommentEvent, status, providerMessageID, errorCode, errorMessage string, isDemo bool) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var ruleID any = nil
	if rule != nil {
		ruleID = rule.ID
	}
	tag, err := tx.Exec(ctx, `INSERT INTO automation_executions(workspace_id,rule_id,event_id,status,provider_message_id,error_code,error_message)
		SELECT $1,$2,w.id,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,'') FROM webhook_events w WHERE w.id=$3 AND w.workspace_id=$1
		ON CONFLICT(event_id) DO UPDATE SET status=EXCLUDED.status,provider_message_id=COALESCE(EXCLUDED.provider_message_id,automation_executions.provider_message_id),error_code=EXCLUDED.error_code,error_message=EXCLUDED.error_message
		WHERE automation_executions.workspace_id=EXCLUDED.workspace_id`, workspaceID, ruleID, eventID, status, providerMessageID, errorCode, errorMessage)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err = tx.Exec(ctx, `UPDATE webhook_events SET processing_status=$3,error_code=NULLIF($4,''),processed_at=now() WHERE id=$1 AND workspace_id=$2`, eventID, workspaceID, mapStatus(status), errorCode); err != nil {
		return err
	}
	if status == "sent" && rule != nil {
		var conversationID string
		participant := event.ParticipantID
		if participant == "" {
			participant = "commenter:" + event.CommentID
		}
		err = tx.QueryRow(ctx, `INSERT INTO conversations(workspace_id,instagram_account_id,participant_id,participant_username,last_message_at)
			VALUES($1,$2,$3,$4,now()) ON CONFLICT(workspace_id,instagram_account_id,participant_id) DO UPDATE SET participant_username=EXCLUDED.participant_username,last_message_at=now() RETURNING id`, workspaceID, rule.InstagramAccountID, participant, event.Username).Scan(&conversationID)
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO messages(conversation_id,provider_message_id,direction,message_text,status,is_demo) VALUES($1,$2,'outbound',$3,'sent',$4) ON CONFLICT(provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING`, conversationID, providerMessageID, rule.ReplyText, isDemo); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func mapStatus(status string) string {
	if status == "sent" || strings.HasPrefix(status, "skipped") || status == "duplicate" {
		return "processed"
	}
	return "failed"
}

type Conversation struct {
	ID                  string     `json:"id"`
	AccountUsername     string     `json:"account_username"`
	ParticipantUsername string     `json:"participant_username"`
	Status              string     `json:"status"`
	UnreadCount         int        `json:"unread_count"`
	CanReplyUntil       *time.Time `json:"can_reply_until,omitempty"`
	LastMessageAt       time.Time  `json:"last_message_at"`
	LastMessage         string     `json:"last_message"`
}
type Message struct {
	ID        string    `json:"id"`
	Direction string    `json:"direction"`
	Text      string    `json:"text"`
	Status    string    `json:"status"`
	IsDemo    bool      `json:"is_demo"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) Conversations(ctx context.Context, workspaceID, search string) ([]Conversation, error) {
	rows, err := s.DB.Query(ctx, `SELECT c.id,a.username,c.participant_username,c.status,c.unread_count,c.can_reply_until,c.last_message_at,COALESCE((SELECT message_text FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1),'') FROM conversations c JOIN instagram_accounts a ON a.id=c.instagram_account_id WHERE c.workspace_id=$1 AND ($2='' OR c.participant_username ILIKE '%'||$2||'%') ORDER BY c.last_message_at DESC LIMIT 100`, workspaceID, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Conversation{}
	for rows.Next() {
		var c Conversation
		if err = rows.Scan(&c.ID, &c.AccountUsername, &c.ParticipantUsername, &c.Status, &c.UnreadCount, &c.CanReplyUntil, &c.LastMessageAt, &c.LastMessage); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

func (s *Store) Messages(ctx context.Context, workspaceID, conversationID string) ([]Message, error) {
	rows, err := s.DB.Query(ctx, `SELECT m.id,m.direction,m.message_text,m.status,m.is_demo,m.created_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND c.id=$2 ORDER BY m.created_at`, workspaceID, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Message{}
	for rows.Next() {
		var m Message
		if err = rows.Scan(&m.ID, &m.Direction, &m.Text, &m.Status, &m.IsDemo, &m.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (s *Store) ConversationForReply(ctx context.Context, workspaceID, conversationID string) (accountID, participantID string, canReplyUntil *time.Time, err error) {
	err = s.DB.QueryRow(ctx, `SELECT instagram_account_id,participant_id,can_reply_until FROM conversations WHERE workspace_id=$1 AND id=$2`, workspaceID, conversationID).Scan(&accountID, &participantID, &canReplyUntil)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}
func (s *Store) AddMessage(ctx context.Context, workspaceID, conversationID, providerMessageID, text string, isDemo bool) error {
	tag, err := s.DB.Exec(ctx, `INSERT INTO messages(conversation_id,provider_message_id,direction,message_text,status,is_demo) SELECT id,$3,'outbound',$4,'sent',$5 FROM conversations WHERE workspace_id=$1 AND id=$2`, workspaceID, conversationID, providerMessageID, text, isDemo)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	_, _ = s.DB.Exec(ctx, `UPDATE conversations SET last_message_at=now() WHERE id=$1`, conversationID)
	return nil
}

// BeginManualMessage commits the browser idempotency key before any provider
// call. A duplicate request returns acquired=false and must never be resent.
func (s *Store) BeginManualMessage(ctx context.Context, workspaceID, conversationID, clientRequestID, text string, isDemo bool) (messageID string, acquired bool, err error) {
	err = s.DB.QueryRow(ctx, `INSERT INTO messages(conversation_id,client_request_id,direction,message_text,status,is_demo)
		SELECT id,$3,'outbound',$4,'sending',$5 FROM conversations WHERE workspace_id=$1 AND id=$2
		ON CONFLICT(conversation_id,client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING RETURNING id`, workspaceID, conversationID, clientRequestID, text, isDemo).Scan(&messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = s.DB.QueryRow(ctx, `SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id
			WHERE c.workspace_id=$1 AND c.id=$2 AND m.client_request_id=$3`, workspaceID, conversationID, clientRequestID).Scan(&messageID)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, ErrNotFound
		}
		return messageID, false, err
	}
	return messageID, err == nil, err
}

func (s *Store) CompleteManualMessage(ctx context.Context, workspaceID, conversationID, messageID, status, providerMessageID string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE messages m SET status=$4,provider_message_id=NULLIF($5,'')
		FROM conversations c WHERE m.id=$3 AND m.conversation_id=c.id AND c.id=$2 AND c.workspace_id=$1 AND m.status='sending'`, workspaceID, conversationID, messageID, status, providerMessageID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if status == "sent" {
		if _, err = tx.Exec(ctx, `UPDATE conversations SET last_message_at=now() WHERE id=$1 AND workspace_id=$2`, conversationID, workspaceID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) Metrics(ctx context.Context, workspaceID string, from, to time.Time) (domain.Metrics, error) {
	var m domain.Metrics
	err := s.DB.QueryRow(ctx, `SELECT count(w.id),count(e.id) FILTER(WHERE e.rule_id IS NOT NULL),count(e.id) FILTER(WHERE e.status='sent'),count(w.id) FILTER(WHERE w.processing_status='failed') FROM webhook_events w LEFT JOIN automation_executions e ON e.event_id=w.id WHERE w.workspace_id=$1 AND w.received_at BETWEEN $2 AND $3`, workspaceID, from, to).Scan(&m.Comments, &m.EligibleTriggers, &m.RepliesSent, &m.Failures)
	if err != nil {
		return m, err
	}
	if m.Comments > 0 {
		m.Conversion = float64(m.RepliesSent) * 100 / float64(m.Comments)
	}
	rows, err := s.DB.Query(ctx, `SELECT to_char(d,'DD Mon'),count(w.id),count(e.id) FILTER(WHERE e.status='sent') FROM generate_series($2::date,$3::date,interval '1 day') d LEFT JOIN webhook_events w ON w.workspace_id=$1 AND w.received_at::date=d::date LEFT JOIN automation_executions e ON e.event_id=w.id GROUP BY d ORDER BY d`, workspaceID, from, to)
	if err != nil {
		return m, err
	}
	defer rows.Close()
	for rows.Next() {
		var p domain.Point
		if err = rows.Scan(&p.Label, &p.Comments, &p.Replies); err != nil {
			return m, err
		}
		m.Series = append(m.Series, p)
	}
	return m, rows.Err()
}

type Plan struct {
	Code         string    `json:"code"`
	Name         string    `json:"name"`
	Status       string    `json:"status"`
	AccountLimit int       `json:"account_limit"`
	RuleLimit    int       `json:"rule_limit"`
	EventLimit   int       `json:"event_limit"`
	PriceUZS     int64     `json:"price_uzs"`
	AccountsUsed int       `json:"accounts_used"`
	RulesUsed    int       `json:"rules_used"`
	PeriodEnd    time.Time `json:"period_end"`
}

func (s *Store) Plan(ctx context.Context, workspaceID string) (Plan, error) {
	var p Plan
	err := s.DB.QueryRow(ctx, `SELECT p.code,p.name,sub.status,p.account_limit,p.rule_limit,p.event_limit,p.price_uzs,(SELECT count(*) FROM instagram_accounts a WHERE a.workspace_id=w.id AND a.status='connected'),(SELECT count(*) FROM automation_rules r WHERE r.workspace_id=w.id),sub.current_period_end FROM workspaces w JOIN plans p ON p.id=w.plan_id JOIN subscriptions sub ON sub.workspace_id=w.id WHERE w.id=$1`, workspaceID).Scan(&p.Code, &p.Name, &p.Status, &p.AccountLimit, &p.RuleLimit, &p.EventLimit, &p.PriceUZS, &p.AccountsUsed, &p.RulesUsed, &p.PeriodEnd)
	return p, err
}

type Member struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) Members(ctx context.Context, workspaceID string) ([]Member, error) {
	rows, err := s.DB.Query(ctx, `SELECT u.id,u.name,u.email,wm.role,wm.created_at FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=$1 ORDER BY wm.created_at`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Member{}
	for rows.Next() {
		var m Member
		if err = rows.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (s *Store) UpdateMemberRole(ctx context.Context, p domain.Principal, memberID, role string) error {
	if role != "manager" && role != "operator" && role != "customer" {
		return ErrInvalidRole
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var currentRole string
	err = tx.QueryRow(ctx, `SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE`, p.WorkspaceID, memberID).Scan(&currentRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if currentRole == "owner" {
		return ErrOwnerProtected
	}
	if _, err = tx.Exec(ctx, `UPDATE workspace_members SET role=$3 WHERE workspace_id=$1 AND user_id=$2`, p.WorkspaceID, memberID, role); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err == nil {
		_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "team.role_changed", "member", memberID, map[string]any{"from": currentRole, "to": role})
	}
	return err
}

func (s *Store) RemoveMember(ctx context.Context, p domain.Principal, memberID string) error {
	if memberID == p.UserID {
		return ErrSelfRemoval
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var currentRole string
	err = tx.QueryRow(ctx, `SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE`, p.WorkspaceID, memberID).Scan(&currentRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if currentRole == "owner" {
		return ErrOwnerProtected
	}
	if _, err = tx.Exec(ctx, `DELETE FROM sessions WHERE workspace_id=$1 AND user_id=$2`, p.WorkspaceID, memberID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2`, p.WorkspaceID, memberID); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err == nil {
		_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "team.member_removed", "member", memberID, map[string]any{"role": currentRole})
	}
	return err
}

type Invitation struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) Invitations(ctx context.Context, workspaceID string) ([]Invitation, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,email,role,expires_at,created_at FROM team_invitations WHERE workspace_id=$1 AND accepted_at IS NULL AND expires_at>now() ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Invitation{}
	for rows.Next() {
		var item Invitation
		if err = rows.Scan(&item.ID, &item.Email, &item.Role, &item.ExpiresAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func (s *Store) CreateInvitation(ctx context.Context, p domain.Principal, email, role string, tokenHash []byte, expires time.Time) error {
	if role != "manager" && role != "operator" && role != "customer" {
		return ErrInvalidRole
	}
	_, err := s.DB.Exec(ctx, `INSERT INTO team_invitations(workspace_id,email,role,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,email) DO UPDATE SET role=EXCLUDED.role,token_hash=EXCLUDED.token_hash,invited_by=EXCLUDED.invited_by,expires_at=EXCLUDED.expires_at,accepted_at=NULL,created_at=now()`, p.WorkspaceID, strings.ToLower(strings.TrimSpace(email)), role, tokenHash, p.UserID, expires)
	if err == nil {
		_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "team.invited", "member", "", map[string]any{"email": strings.ToLower(strings.TrimSpace(email)), "role": role})
	}
	return err
}

func (s *Store) CancelInvitation(ctx context.Context, p domain.Principal, invitationID string) error {
	tag, err := s.DB.Exec(ctx, `DELETE FROM team_invitations WHERE id=$1 AND workspace_id=$2 AND accepted_at IS NULL`, invitationID, p.WorkspaceID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "team.invitation_cancelled", "invitation", invitationID, nil)
	return nil
}
func (s *Store) AcceptInvitation(ctx context.Context, p domain.Principal, tokenHash []byte) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var invitationID, workspaceID, role, email string
	err = tx.QueryRow(ctx, `SELECT id,workspace_id,role,email FROM team_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>now() FOR UPDATE`, tokenHash).Scan(&invitationID, &workspaceID, &role, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if !strings.EqualFold(email, p.Email) {
		return errors.New("invitation email mismatch")
	}
	if _, err = tx.Exec(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role`, workspaceID, p.UserID, role); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE team_invitations SET accepted_at=now() WHERE id=$1`, invitationID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) ChangePlan(ctx context.Context, p domain.Principal, code string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var planID string
	if err = tx.QueryRow(ctx, `SELECT id FROM plans WHERE code=$1 AND is_active=true`, code).Scan(&planID); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE workspaces SET plan_id=$1 WHERE id=$2`, planID, p.WorkspaceID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE subscriptions SET plan_id=$1,status='active',current_period_start=now(),current_period_end=now()+interval '30 days' WHERE workspace_id=$2`, planID, p.WorkspaceID); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err == nil {
		_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "billing.plan_changed", "workspace", p.WorkspaceID, map[string]any{"plan": code, "mode": "manual_demo"})
	}
	return err
}

func (s *Store) Settings(ctx context.Context, p domain.Principal) (map[string]any, error) {
	plan, err := s.Plan(ctx, p.WorkspaceID)
	if err != nil {
		return nil, err
	}
	var webhookFailures, queued int
	var language string
	var notifications bool
	_ = s.DB.QueryRow(ctx, `SELECT preferred_language,notifications_enabled FROM users WHERE id=$1`, p.UserID).Scan(&language, &notifications)
	_ = s.DB.QueryRow(ctx, `SELECT count(*) FILTER(WHERE processing_status='failed' AND received_at>now()-interval '24 hours'),count(*) FILTER(WHERE processing_status='queued') FROM webhook_events WHERE workspace_id=$1`, p.WorkspaceID).Scan(&webhookFailures, &queued)
	return map[string]any{"profile": map[string]any{"name": p.Name, "email": p.Email}, "workspace": map[string]any{"id": p.WorkspaceID, "name": p.Workspace, "role": p.Role}, "plan": plan, "webhook": map[string]any{"failed_last_24h": webhookFailures, "queued": queued}, "language": language, "notifications_enabled": notifications}, nil
}
func (s *Store) UpdateSettings(ctx context.Context, p domain.Principal, name, workspaceName, language string, notifications bool) error {
	if language != "uz" && language != "ru" && language != "en" {
		return errors.New("invalid language")
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE users SET name=$1,preferred_language=$2,notifications_enabled=$3 WHERE id=$4`, strings.TrimSpace(name), language, notifications, p.UserID); err != nil {
		return err
	}
	if roleRank(p.Role) >= roleRank("owner") {
		if _, err = tx.Exec(ctx, `UPDATE workspaces SET name=$1 WHERE id=$2`, strings.TrimSpace(workspaceName), p.WorkspaceID); err != nil {
			return err
		}
	}
	if err = tx.Commit(ctx); err == nil {
		_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "settings.updated", "workspace", p.WorkspaceID, nil)
	}
	return err
}
func roleRank(role string) int {
	return map[string]int{"customer": 1, "operator": 2, "manager": 3, "owner": 4}[role]
}

func (s *Store) Audit(ctx context.Context, workspaceID, userID, action, entityType, entityID string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, _ := json.Marshal(metadata)
	_, err := s.DB.Exec(ctx, `INSERT INTO audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata_redacted) VALUES($1,NULLIF($2,'')::uuid,$3,$4,NULLIF($5,''),$6)`, workspaceID, userID, action, entityType, entityID, raw)
	return err
}

type AuditEntry struct {
	ID         string          `json:"id"`
	ActorName  string          `json:"actor_name"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type"`
	EntityID   string          `json:"entity_id,omitempty"`
	Metadata   json.RawMessage `json:"metadata"`
	CreatedAt  time.Time       `json:"created_at"`
}

func (s *Store) AuditEntries(ctx context.Context, workspaceID string, limit int) ([]AuditEntry, error) {
	if limit < 1 || limit > 200 {
		limit = 100
	}
	rows, err := s.DB.Query(ctx, `SELECT a.id,COALESCE(u.name,'System'),a.action,a.entity_type,COALESCE(a.entity_id,''),a.metadata_redacted,a.created_at FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.workspace_id=$1 ORDER BY a.created_at DESC LIMIT $2`, workspaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []AuditEntry{}
	for rows.Next() {
		var item AuditEntry
		if err = rows.Scan(&item.ID, &item.ActorName, &item.Action, &item.EntityType, &item.EntityID, &item.Metadata, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) SeedDemo(ctx context.Context, passwordHash, encryptedToken string) (string, error) {
	var userID, workspaceID string
	err := s.DB.QueryRow(ctx, `SELECT u.id,w.id FROM users u JOIN workspace_members wm ON wm.user_id=u.id JOIN workspaces w ON w.id=wm.workspace_id WHERE u.email='demo@ids.uz' ORDER BY CASE wm.role WHEN 'owner' THEN 1 ELSE 2 END LIMIT 1`).Scan(&userID, &workspaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		p, id, regErr := s.Register(ctx, "Demo foydalanuvchi", "demo@ids.uz", passwordHash)
		if regErr != nil {
			return "", regErr
		}
		userID = id
		workspaceID = p.WorkspaceID
	} else if err != nil {
		return "", err
	}
	_, err = s.DB.Exec(ctx, `INSERT INTO instagram_accounts(workspace_id,instagram_user_id,username,account_type,token_ciphertext,scopes,status,provider,connected_by,last_sync_at) VALUES($1::uuid,'mock-'||$1::text,'ids.demo.'||left($1::text,8),'BUSINESS',$2,ARRAY['instagram_business_basic','instagram_business_manage_comments','instagram_business_manage_messages'],'connected','mock',$3,now()) ON CONFLICT(workspace_id,instagram_user_id) DO UPDATE SET token_ciphertext=EXCLUDED.token_ciphertext,status='connected',last_sync_at=now()`, workspaceID, encryptedToken, userID)
	if err != nil {
		return "", err
	}
	var accountID string
	if err = s.DB.QueryRow(ctx, `SELECT id FROM instagram_accounts WHERE workspace_id=$1 AND provider='mock' ORDER BY connected_at LIMIT 1`, workspaceID).Scan(&accountID); err != nil {
		return "", err
	}
	_, err = s.DB.Exec(ctx, `INSERT INTO automation_rules(workspace_id,instagram_account_id,name,match_mode,keywords,reply_text,is_active,priority)
		SELECT $1,$2,'Narx so‘rovi','contains',ARRAY['narx','qancha'],'Assalomu alaykum! Narxlar va batafsil ma’lumot: https://ids.uz/demo',true,10
		WHERE NOT EXISTS(SELECT 1 FROM automation_rules WHERE workspace_id=$1 AND name='Narx so‘rovi')`, workspaceID, accountID)
	if err != nil {
		return "", err
	}
	_, err = s.DB.Exec(ctx, `UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1`, userID)
	if err != nil {
		return "", err
	}
	return userID, nil
}

func (s *Store) DebugCounts(ctx context.Context) string {
	var users int
	_ = s.DB.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&users)
	return fmt.Sprintf("users=%d", users)
}
