package store

import (
	"context"
	"crypto/sha256"
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
var ErrAccountClaimed = errors.New("provider account is already connected to another workspace")
var ErrEmailUnverified = errors.New("email is not verified")
var ErrOwnerProtected = errors.New("workspace owner membership is protected")
var ErrSelfRemoval = errors.New("the active owner cannot remove their own membership")
var ErrInvalidRole = errors.New("invalid role")
var ErrGoogleAccountNotFound = errors.New("google login account not found")
var ErrGoogleIdentityConflict = errors.New("google identity is already linked to another account")
var ErrInstagramIdentityConflict = errors.New("Instagram identity is linked to another workspace")
var ErrInstagramIdentityNotFound = errors.New("Instagram identity is not registered")
var ErrInstagramIdentityExists = errors.New("Instagram identity is already registered")

type GoogleLoginState struct {
	Nonce        string
	CodeVerifier string
	Intent       string
	AcceptTerms  bool
	RememberMe   bool
}

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
	err = tx.QueryRow(ctx, `INSERT INTO workspaces(name,owner_user_id) VALUES($1,$2) RETURNING id`, workspaceName, userID).Scan(&workspaceID)
	if err != nil {
		return domain.Principal{}, "", err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')`, workspaceID, userID); err != nil {
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
	err := s.DB.QueryRow(ctx, `SELECT u.id,u.name,
		CASE WHEN u.email::text LIKE '%@instagram.ids.invalid' THEN '' ELSE u.email::text END,
		w.id,w.name,wm.role,s.id,s.expires_at,s.csrf_token,
		(u.email_verified_at IS NOT NULL OR EXISTS(SELECT 1 FROM instagram_oauth_identities ii WHERE ii.user_id=u.id)),
		CASE WHEN EXISTS(SELECT 1 FROM instagram_oauth_identities ii WHERE ii.user_id=u.id) THEN 'instagram'
			WHEN EXISTS(SELECT 1 FROM oauth_identities oi WHERE oi.user_id=u.id AND oi.provider='google') THEN 'google' ELSE 'email' END
		FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspaces w ON w.id=s.workspace_id
		JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=u.id
		WHERE s.token_hash=$1 AND s.expires_at>now()`, tokenHash).
		Scan(&p.UserID, &p.Name, &p.Email, &p.WorkspaceID, &p.Workspace, &p.Role, &p.SessionID, &p.SessionExpiresAt, &p.CSRFToken, &verified, &p.LoginProvider)
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

func (s *Store) SaveGoogleLoginState(ctx context.Context, hash []byte, state GoogleLoginState, expires time.Time) error {
	if _, err := s.DB.Exec(ctx, `DELETE FROM google_oauth_login_states WHERE expires_at < now() OR used_at IS NOT NULL`); err != nil {
		return err
	}
	_, err := s.DB.Exec(ctx, `INSERT INTO google_oauth_login_states(state_hash,nonce,code_verifier,intent,accept_terms,remember_me,expires_at)
		VALUES($1,$2,$3,$4,$5,$6,$7)`, hash, state.Nonce, state.CodeVerifier, state.Intent, state.AcceptTerms, state.RememberMe, expires)
	return err
}

func (s *Store) ConsumeGoogleLoginState(ctx context.Context, hash []byte) (state GoogleLoginState, err error) {
	err = s.DB.QueryRow(ctx, `UPDATE google_oauth_login_states SET used_at=now()
		WHERE state_hash=$1 AND used_at IS NULL AND expires_at>now()
		RETURNING nonce,code_verifier,intent,accept_terms,remember_me`, hash).
		Scan(&state.Nonce, &state.CodeVerifier, &state.Intent, &state.AcceptTerms, &state.RememberMe)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

type InstagramLoginState struct {
	BrowserBindingHash []byte
	RememberMe         bool
	AcceptTerms        bool
	TermsAcceptedAt    time.Time
}

func (s *Store) SaveInstagramLoginState(ctx context.Context, stateHash, browserBindingHash []byte, state InstagramLoginState, expires time.Time) error {
	if _, err := s.DB.Exec(ctx, `DELETE FROM instagram_oauth_login_states WHERE expires_at<now() OR used_at IS NOT NULL`); err != nil {
		return err
	}
	_, err := s.DB.Exec(ctx, `INSERT INTO instagram_oauth_login_states(state_hash,browser_binding_hash,remember_me,accept_terms,expires_at)
		VALUES($1,$2,$3,$4,$5)`, stateHash, browserBindingHash, state.RememberMe, state.AcceptTerms, expires)
	return err
}

func (s *Store) ConsumeInstagramLoginState(ctx context.Context, stateHash, browserBindingHash []byte) (state InstagramLoginState, err error) {
	err = s.DB.QueryRow(ctx, `UPDATE instagram_oauth_login_states SET used_at=now()
		WHERE state_hash=$1 AND browser_binding_hash=$2 AND used_at IS NULL AND expires_at>now()
		RETURNING browser_binding_hash,remember_me,accept_terms,created_at`, stateHash, browserBindingHash).
		Scan(&state.BrowserBindingHash, &state.RememberMe, &state.AcceptTerms, &state.TermsAcceptedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

// CompleteInstagramLogin binds a verified Meta Instagram identity to an
// existing workspace for login, or creates a new owner workspace for register.
// The account, encrypted token and identity mapping commit atomically.
func (s *Store) CompleteInstagramLogin(ctx context.Context, in AccountInput, passwordHash, intent string, termsAcceptedAt time.Time) (domain.Principal, string, error) {
	if strings.TrimSpace(in.InstagramUserID) == "" || strings.TrimSpace(in.TokenCiphertext) == "" || strings.TrimSpace(in.Provider) == "" {
		return domain.Principal{}, "", errors.New("verified Instagram account identity and encrypted token are required")
	}
	if intent != "login" && intent != "register" {
		return domain.Principal{}, "", errors.New("Instagram authentication intent must be login or register")
	}
	if termsAcceptedAt.IsZero() {
		return domain.Principal{}, "", errors.New("terms acceptance timestamp is required")
	}
	if in.Scopes == nil {
		in.Scopes = []string{}
	}
	username := strings.TrimPrefix(strings.TrimSpace(in.Username), "@")
	if username == "" {
		username = "Instagram"
	}
	if utf8.RuneCountInString(username) > 72 {
		username = string([]rune(username)[:72])
	}
	name := "@" + username
	emailDigest := sha256.Sum256([]byte(in.Provider + ":" + in.InstagramUserID))
	syntheticEmail := fmt.Sprintf("ig-%x@instagram.ids.invalid", emailDigest[:])

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return domain.Principal{}, "", err
	}
	defer tx.Rollback(ctx)
	lockKey := in.Provider + ":" + in.InstagramUserID
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, lockKey); err != nil {
		return domain.Principal{}, "", err
	}

	var userID, workspaceID string
	err = tx.QueryRow(ctx, `SELECT user_id,workspace_id FROM instagram_oauth_identities
		WHERE provider=$1 AND instagram_user_id=$2 FOR UPDATE`, in.Provider, in.InstagramUserID).Scan(&userID, &workspaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		var existingWorkspace, connectedBy string
		accountErr := tx.QueryRow(ctx, `SELECT workspace_id,connected_by FROM instagram_accounts
			WHERE provider=$1 AND instagram_user_id=$2 ORDER BY connected_at LIMIT 1 FOR UPDATE`,
			in.Provider, in.InstagramUserID).Scan(&existingWorkspace, &connectedBy)
		if accountErr == nil {
			if intent == "register" {
				return domain.Principal{}, "", ErrInstagramIdentityExists
			}
			userID, workspaceID = connectedBy, existingWorkspace
		} else if errors.Is(accountErr, pgx.ErrNoRows) && intent == "login" {
			return domain.Principal{}, "", ErrInstagramIdentityNotFound
		} else if errors.Is(accountErr, pgx.ErrNoRows) {
			if passwordHash == "" {
				return domain.Principal{}, "", errors.New("unusable local credential hash is required")
			}
			if err = tx.QueryRow(ctx, `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id`, name, syntheticEmail, passwordHash).Scan(&userID); err != nil {
				return domain.Principal{}, "", err
			}
			workspaceName := name + " workspace"
			if utf8.RuneCountInString(workspaceName) > 100 {
				workspaceName = string([]rune(workspaceName)[:100])
			}
			if err = tx.QueryRow(ctx, `INSERT INTO workspaces(name,owner_user_id) VALUES($1,$2) RETURNING id`, workspaceName, userID).Scan(&workspaceID); err != nil {
				return domain.Principal{}, "", err
			}
			if _, err = tx.Exec(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')`, workspaceID, userID); err != nil {
				return domain.Principal{}, "", err
			}
		} else {
			return domain.Principal{}, "", accountErr
		}
		if _, err = tx.Exec(ctx, `INSERT INTO instagram_oauth_identities(provider,instagram_user_id,user_id,workspace_id,username,terms_accepted_at)
			VALUES($1,$2,$3,$4,$5,$6)`, in.Provider, in.InstagramUserID, userID, workspaceID, username, termsAcceptedAt); err != nil {
			if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
				return domain.Principal{}, "", ErrInstagramIdentityConflict
			}
			return domain.Principal{}, "", err
		}
	} else if err != nil {
		return domain.Principal{}, "", err
	} else {
		if intent == "register" {
			return domain.Principal{}, "", ErrInstagramIdentityExists
		}
		if _, err = tx.Exec(ctx, `UPDATE instagram_oauth_identities SET username=$1,terms_accepted_at=$2
			WHERE provider=$3 AND instagram_user_id=$4`, username, termsAcceptedAt, in.Provider, in.InstagramUserID); err != nil {
			return domain.Principal{}, "", err
		}
	}

	var member bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2)`, workspaceID, userID).Scan(&member); err != nil {
		return domain.Principal{}, "", err
	}
	if !member {
		return domain.Principal{}, "", ErrInstagramIdentityConflict
	}
	var accountID string
	err = tx.QueryRow(ctx, `INSERT INTO instagram_accounts(workspace_id,instagram_user_id,username,account_type,avatar_url,token_ciphertext,token_expires_at,scopes,status,provider,connected_by,last_sync_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,'connected',$9,$10,now())
		ON CONFLICT(workspace_id,instagram_user_id) DO UPDATE SET username=EXCLUDED.username,account_type=EXCLUDED.account_type,
		avatar_url=EXCLUDED.avatar_url,token_ciphertext=EXCLUDED.token_ciphertext,token_expires_at=EXCLUDED.token_expires_at,
		scopes=EXCLUDED.scopes,status='connected',provider=EXCLUDED.provider,connected_by=EXCLUDED.connected_by,last_sync_at=now()
		RETURNING id`, workspaceID, in.InstagramUserID, username, in.AccountType, in.AvatarURL, in.TokenCiphertext, in.TokenExpiresAt, in.Scopes, in.Provider, userID).Scan(&accountID)
	if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
		return domain.Principal{}, "", ErrAccountClaimed
	}
	if err != nil {
		return domain.Principal{}, "", err
	}
	principal, err := instagramPrincipalForUserWorkspace(ctx, tx, userID, workspaceID)
	if err != nil {
		return domain.Principal{}, "", err
	}
	principal.LoginProvider = "instagram"
	metadata, _ := json.Marshal(map[string]any{"provider": in.Provider})
	if _, err = tx.Exec(ctx, `INSERT INTO audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata_redacted)
		VALUES($1,$2,'auth.instagram_login','instagram_identity',$3,$4)`, workspaceID, userID, in.InstagramUserID, metadata); err != nil {
		return domain.Principal{}, "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.Principal{}, "", err
	}
	return principal, accountID, nil
}

func instagramPrincipalForUserWorkspace(ctx context.Context, tx pgx.Tx, userID, workspaceID string) (domain.Principal, error) {
	var principal domain.Principal
	err := tx.QueryRow(ctx, `SELECT u.id,u.name,CASE WHEN u.email::text LIKE '%@instagram.ids.invalid' THEN '' ELSE u.email::text END,
		w.id,w.name,wm.role FROM users u JOIN workspace_members wm ON wm.user_id=u.id JOIN workspaces w ON w.id=wm.workspace_id
		WHERE u.id=$1 AND w.id=$2`, userID, workspaceID).
		Scan(&principal.UserID, &principal.Name, &principal.Email, &principal.WorkspaceID, &principal.Workspace, &principal.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Principal{}, ErrNotFound
	}
	return principal, err
}

// CompleteGoogleLogin links only a verified Google subject. New users receive
// their own workspace in the same transaction as the identity mapping.
func (s *Store) CompleteGoogleLogin(ctx context.Context, subject, email, name, passwordHash string, allowCreate bool) (domain.Principal, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return domain.Principal{}, err
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `SELECT user_id FROM oauth_identities WHERE provider='google' AND provider_subject=$1`, subject).Scan(&userID)
	if err == nil {
		principal, principalErr := googlePrincipalForUser(ctx, tx, userID)
		if principalErr != nil {
			return domain.Principal{}, principalErr
		}
		if err = tx.Commit(ctx); err != nil {
			return domain.Principal{}, err
		}
		return principal, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return domain.Principal{}, err
	}

	email = strings.ToLower(strings.TrimSpace(email))
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, email); err != nil {
		return domain.Principal{}, err
	}
	var existingName string
	err = tx.QueryRow(ctx, `SELECT id,name FROM users WHERE email=$1 FOR UPDATE`, email).Scan(&userID, &existingName)
	if errors.Is(err, pgx.ErrNoRows) {
		if !allowCreate {
			return domain.Principal{}, ErrGoogleAccountNotFound
		}
		name = strings.TrimSpace(name)
		if name == "" {
			name = strings.SplitN(email, "@", 2)[0]
		}
		if utf8.RuneCountInString(name) > 80 {
			name = string([]rune(name)[:80])
		}
		if utf8.RuneCountInString(name) < 2 {
			name = "Google user"
		}
		if err = tx.QueryRow(ctx, `INSERT INTO users(name,email,password_hash,email_verified_at)
			VALUES($1,$2,$3,now()) RETURNING id`, name, email, passwordHash).Scan(&userID); err != nil {
			return domain.Principal{}, err
		}
		workspaceName := name + " workspace"
		var workspaceID string
		if err = tx.QueryRow(ctx, `INSERT INTO workspaces(name,owner_user_id) VALUES($1,$2) RETURNING id`, workspaceName, userID).Scan(&workspaceID); err != nil {
			return domain.Principal{}, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')`, workspaceID, userID); err != nil {
			return domain.Principal{}, err
		}
	} else if err != nil {
		return domain.Principal{}, err
	} else {
		if _, err = tx.Exec(ctx, `UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1`, userID); err != nil {
			return domain.Principal{}, err
		}
	}

	if _, err = tx.Exec(ctx, `INSERT INTO oauth_identities(user_id,provider,provider_subject,email_at_link)
		VALUES($1,'google',$2,$3)`, userID, subject, email); err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return domain.Principal{}, ErrGoogleIdentityConflict
		}
		return domain.Principal{}, err
	}
	principal, err := googlePrincipalForUser(ctx, tx, userID)
	if err != nil {
		return domain.Principal{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.Principal{}, err
	}
	return principal, nil
}

func googlePrincipalForUser(ctx context.Context, tx pgx.Tx, userID string) (domain.Principal, error) {
	var principal domain.Principal
	err := tx.QueryRow(ctx, `SELECT u.id,u.name,u.email,w.id,w.name,wm.role
		FROM users u JOIN workspace_members wm ON wm.user_id=u.id JOIN workspaces w ON w.id=wm.workspace_id
		WHERE u.id=$1 ORDER BY CASE wm.role WHEN 'owner' THEN 1 ELSE 2 END,w.created_at,w.id LIMIT 1`, userID).
		Scan(&principal.UserID, &principal.Name, &principal.Email, &principal.WorkspaceID, &principal.Workspace, &principal.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Principal{}, ErrNotFound
	}
	return principal, err
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
	_, err := s.DB.Exec(ctx, `INSERT INTO instagram_accounts(workspace_id,instagram_user_id,username,account_type,avatar_url,token_ciphertext,token_expires_at,scopes,status,provider,connected_by,last_sync_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,'connected',$9,$10,now()) ON CONFLICT(workspace_id,instagram_user_id) DO UPDATE SET username=EXCLUDED.username,account_type=EXCLUDED.account_type,avatar_url=EXCLUDED.avatar_url,token_ciphertext=EXCLUDED.token_ciphertext,token_expires_at=EXCLUDED.token_expires_at,scopes=EXCLUDED.scopes,status='connected',provider=EXCLUDED.provider,connected_by=EXCLUDED.connected_by,last_sync_at=now()`, workspaceID, in.InstagramUserID, in.Username, in.AccountType, in.AvatarURL, in.TokenCiphertext, in.TokenExpiresAt, in.Scopes, in.Provider, userID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "instagram_accounts_active_provider_uidx" {
		return ErrAccountClaimed
	}
	if err != nil {
		return err
	}
	_ = s.Audit(ctx, workspaceID, userID, "instagram.connected", "instagram_account", in.InstagramUserID, map[string]any{"provider": in.Provider})
	return nil
}

func (s *Store) ListInstagramAccounts(ctx context.Context, workspaceID string) ([]domain.InstagramAccount, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,instagram_user_id,username,account_type,COALESCE(avatar_url,''),status,provider,scopes,token_expires_at,connected_at,last_sync_at FROM instagram_accounts WHERE workspace_id=$1 AND provider<>'mock' ORDER BY connected_at DESC`, workspaceID)
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

func (s *Store) AccountSecretByID(ctx context.Context, workspaceID, id string) (providerAccountID, tokenCiphertext, provider string, scopes []string, err error) {
	err = s.DB.QueryRow(ctx, `SELECT instagram_user_id,token_ciphertext,provider,scopes FROM instagram_accounts WHERE id=$1 AND workspace_id=$2 AND status='connected'`, id, workspaceID).Scan(&providerAccountID, &tokenCiphertext, &provider, &scopes)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

func normalizeRule(r domain.AutomationRule) (domain.AutomationRule, error) {
	r.Name = strings.TrimSpace(r.Name)
	r.PrivateReplyText = strings.TrimSpace(r.PrivateReplyText)
	r.PublicSuccessReplyText = strings.TrimSpace(r.PublicSuccessReplyText)
	r.PublicNotFollowerReplyText = strings.TrimSpace(r.PublicNotFollowerReplyText)
	r.PublicUnknownReplyText = strings.TrimSpace(r.PublicUnknownReplyText)
	if utf8.RuneCountInString(r.Name) < 2 || utf8.RuneCountInString(r.Name) > 100 || len(r.Keywords) == 0 || r.PrivateReplyText == "" || r.PublicSuccessReplyText == "" {
		return r, errors.New("name must be 2-100 characters; keywords, private reply and success public reply are required")
	}
	if r.MatchMode != "exact" && r.MatchMode != "contains" && r.MatchMode != "keyword_list" {
		return r, errors.New("invalid match mode")
	}
	for _, text := range []string{r.PrivateReplyText, r.PublicSuccessReplyText, r.PublicNotFollowerReplyText, r.PublicUnknownReplyText} {
		if utf8.RuneCountInString(text) > 1000 {
			return r, errors.New("reply text is too long")
		}
	}
	if r.FollowVerificationEnabled && (r.PublicNotFollowerReplyText == "" || r.PublicUnknownReplyText == "") {
		return r, errors.New("follow verification requires non-follower and unknown public replies")
	}
	if r.UnknownFallbackPolicy == "" {
		r.UnknownFallbackPolicy = "skip_dm_neutral_reply"
	}
	if r.UnknownFallbackPolicy != "send_private_reply" && r.UnknownFallbackPolicy != "skip_dm_neutral_reply" {
		return r, errors.New("invalid unknown fallback policy")
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
	err = s.DB.QueryRow(ctx, `INSERT INTO automation_rules(workspace_id,instagram_account_id,name,trigger_type,match_mode,keywords,exclusions,media_scope,media_ids,reply_text,private_reply_text,public_success_reply_text,public_not_follower_reply_text,public_unknown_reply_text,follow_verification_enabled,unknown_fallback_policy,is_active,priority)
		SELECT $1,a.id,$3,'comment_created',$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16 FROM instagram_accounts a WHERE a.id=$2 AND a.workspace_id=$1 AND a.status='connected' AND a.provider<>'mock' RETURNING id,created_at,updated_at`, p.WorkspaceID, r.InstagramAccountID, r.Name, r.MatchMode, r.Keywords, r.Exclusions, r.MediaScope, r.MediaIDs, r.PrivateReplyText, r.PublicSuccessReplyText, r.PublicNotFollowerReplyText, r.PublicUnknownReplyText, r.FollowVerificationEnabled, r.UnknownFallbackPolicy, r.IsActive, r.Priority).Scan(&r.ID, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	_ = s.Audit(ctx, p.WorkspaceID, p.UserID, "automation.created", "automation_rule", r.ID, nil)
	return r, nil
}

func (s *Store) ListRules(ctx context.Context, workspaceID string) ([]domain.AutomationRule, error) {
	rows, err := s.DB.Query(ctx, `SELECT r.id,r.instagram_account_id,a.username,r.name,r.trigger_type,r.match_mode,r.keywords,r.exclusions,r.media_scope,r.media_ids,r.private_reply_text,r.public_success_reply_text,r.public_not_follower_reply_text,r.public_unknown_reply_text,r.follow_verification_enabled,r.unknown_fallback_policy,r.is_active,r.priority,r.created_at,r.updated_at FROM automation_rules r JOIN instagram_accounts a ON a.id=r.instagram_account_id WHERE r.workspace_id=$1 AND a.provider<>'mock' ORDER BY r.priority,r.created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.AutomationRule{}
	for rows.Next() {
		var r domain.AutomationRule
		if err = rows.Scan(&r.ID, &r.InstagramAccountID, &r.AccountUsername, &r.Name, &r.TriggerType, &r.MatchMode, &r.Keywords, &r.Exclusions, &r.MediaScope, &r.MediaIDs, &r.PrivateReplyText, &r.PublicSuccessReplyText, &r.PublicNotFollowerReplyText, &r.PublicUnknownReplyText, &r.FollowVerificationEnabled, &r.UnknownFallbackPolicy, &r.IsActive, &r.Priority, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (s *Store) GetRule(ctx context.Context, workspaceID, id string) (domain.AutomationRule, error) {
	var r domain.AutomationRule
	err := s.DB.QueryRow(ctx, `SELECT r.id,r.instagram_account_id,a.username,r.name,r.trigger_type,r.match_mode,r.keywords,r.exclusions,r.media_scope,r.media_ids,r.private_reply_text,r.public_success_reply_text,r.public_not_follower_reply_text,r.public_unknown_reply_text,r.follow_verification_enabled,r.unknown_fallback_policy,r.is_active,r.priority,r.created_at,r.updated_at FROM automation_rules r JOIN instagram_accounts a ON a.id=r.instagram_account_id WHERE r.workspace_id=$1 AND r.id=$2 AND a.provider<>'mock'`, workspaceID, id).Scan(&r.ID, &r.InstagramAccountID, &r.AccountUsername, &r.Name, &r.TriggerType, &r.MatchMode, &r.Keywords, &r.Exclusions, &r.MediaScope, &r.MediaIDs, &r.PrivateReplyText, &r.PublicSuccessReplyText, &r.PublicNotFollowerReplyText, &r.PublicUnknownReplyText, &r.FollowVerificationEnabled, &r.UnknownFallbackPolicy, &r.IsActive, &r.Priority, &r.CreatedAt, &r.UpdatedAt)
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
	err = s.DB.QueryRow(ctx, `UPDATE automation_rules SET name=$3,match_mode=$4,keywords=$5,exclusions=$6,media_scope=$7,media_ids=$8,reply_text=$9,private_reply_text=$9,public_success_reply_text=$10,public_not_follower_reply_text=$11,public_unknown_reply_text=$12,follow_verification_enabled=$13,unknown_fallback_policy=$14,is_active=$15,priority=$16,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING updated_at`, p.WorkspaceID, r.ID, r.Name, r.MatchMode, r.Keywords, r.Exclusions, r.MediaScope, r.MediaIDs, r.PrivateReplyText, r.PublicSuccessReplyText, r.PublicNotFollowerReplyText, r.PublicUnknownReplyText, r.FollowVerificationEnabled, r.UnknownFallbackPolicy, r.IsActive, r.Priority).Scan(&r.UpdatedAt)
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
	rows, err := s.DB.Query(ctx, `SELECT id,instagram_account_id,name,trigger_type,match_mode,keywords,exclusions,media_scope,media_ids,private_reply_text,public_success_reply_text,public_not_follower_reply_text,public_unknown_reply_text,follow_verification_enabled,unknown_fallback_policy,is_active,priority,created_at,updated_at FROM automation_rules WHERE workspace_id=$1 AND instagram_account_id=$2 AND is_active=true ORDER BY priority,created_at`, workspaceID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.AutomationRule{}
	for rows.Next() {
		var r domain.AutomationRule
		if err = rows.Scan(&r.ID, &r.InstagramAccountID, &r.Name, &r.TriggerType, &r.MatchMode, &r.Keywords, &r.Exclusions, &r.MediaScope, &r.MediaIDs, &r.PrivateReplyText, &r.PublicSuccessReplyText, &r.PublicNotFollowerReplyText, &r.PublicUnknownReplyText, &r.FollowVerificationEnabled, &r.UnknownFallbackPolicy, &r.IsActive, &r.Priority, &r.CreatedAt, &r.UpdatedAt); err != nil {
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

type ActionState struct {
	ID               string
	ActionType       string
	Status           string
	MessageText      string
	Outcome          string
	ProviderResultID string
	ErrorCode        string
	ErrorMessage     string
	AttemptCount     int
	StartedAt        time.Time
	CompletedAt      *time.Time
}

func (s *Store) EnsureExecution(ctx context.Context, eventID, workspaceID, ruleID string) (executionID string, followStatus domain.FollowerStatus, err error) {
	err = s.DB.QueryRow(ctx, `INSERT INTO automation_executions(workspace_id,rule_id,event_id,status)
		SELECT $1,r.id,w.id,'processing'
		FROM webhook_events w
		LEFT JOIN automation_rules r ON r.id=NULLIF($2,'')::uuid AND r.workspace_id=$1
		WHERE w.id=$3 AND w.workspace_id=$1 AND ($2='' OR r.id IS NOT NULL)
		ON CONFLICT(event_id) DO UPDATE SET rule_id=COALESCE(automation_executions.rule_id,EXCLUDED.rule_id)
		WHERE automation_executions.workspace_id=EXCLUDED.workspace_id
		RETURNING id,follow_status`, workspaceID, ruleID, eventID).Scan(&executionID, &followStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

// BeginAction commits an idempotency marker before an external side effect.
// Only a public reply explicitly rejected with a retryable response may be
// reacquired; private replies and ambiguous outcomes remain fail-closed.
func (s *Store) BeginAction(ctx context.Context, workspaceID, executionID, actionType, messageText string, allowRetry bool) (ActionState, bool, error) {
	var state ActionState
	err := s.DB.QueryRow(ctx, `INSERT INTO automation_execution_actions(workspace_id,execution_id,action_type,status,message_text)
		SELECT $1,e.id,$3,'sending',NULLIF($4,'') FROM automation_executions e WHERE e.id=$2 AND e.workspace_id=$1
		ON CONFLICT(execution_id,action_type) DO NOTHING
		RETURNING id,action_type,status,COALESCE(message_text,''),COALESCE(outcome,''),COALESCE(provider_result_id,''),COALESCE(error_code,''),COALESCE(error_message,''),attempt_count,started_at,completed_at`, workspaceID, executionID, actionType, messageText).Scan(
		&state.ID, &state.ActionType, &state.Status, &state.MessageText, &state.Outcome, &state.ProviderResultID, &state.ErrorCode, &state.ErrorMessage, &state.AttemptCount, &state.StartedAt, &state.CompletedAt,
	)
	if err == nil {
		return state, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return state, false, err
	}
	if allowRetry && actionType == "public_reply" {
		err = s.DB.QueryRow(ctx, `UPDATE automation_execution_actions a SET status='sending',attempt_count=attempt_count+1,started_at=now(),completed_at=NULL,error_code=NULL,error_message=NULL,updated_at=now()
			FROM automation_executions e WHERE a.execution_id=e.id AND a.execution_id=$2 AND a.workspace_id=$1 AND e.workspace_id=$1
			AND a.action_type='public_reply' AND a.status='failed_retryable' AND a.attempt_count<3
			RETURNING a.id,a.action_type,a.status,COALESCE(a.message_text,''),COALESCE(a.outcome,''),COALESCE(a.provider_result_id,''),COALESCE(a.error_code,''),COALESCE(a.error_message,''),a.attempt_count,a.started_at,a.completed_at`, workspaceID, executionID).Scan(
			&state.ID, &state.ActionType, &state.Status, &state.MessageText, &state.Outcome, &state.ProviderResultID, &state.ErrorCode, &state.ErrorMessage, &state.AttemptCount, &state.StartedAt, &state.CompletedAt,
		)
		if err == nil {
			return state, true, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return state, false, err
		}
	}
	state, err = s.ActionState(ctx, workspaceID, executionID, actionType)
	return state, false, err
}

func (s *Store) ActionState(ctx context.Context, workspaceID, executionID, actionType string) (ActionState, error) {
	var state ActionState
	err := s.DB.QueryRow(ctx, `SELECT a.id,a.action_type,a.status,COALESCE(a.message_text,''),COALESCE(a.outcome,''),COALESCE(a.provider_result_id,''),COALESCE(a.error_code,''),COALESCE(a.error_message,''),a.attempt_count,a.started_at,a.completed_at
		FROM automation_execution_actions a JOIN automation_executions e ON e.id=a.execution_id
		WHERE a.workspace_id=$1 AND e.workspace_id=$1 AND a.execution_id=$2 AND a.action_type=$3`, workspaceID, executionID, actionType).Scan(
		&state.ID, &state.ActionType, &state.Status, &state.MessageText, &state.Outcome, &state.ProviderResultID, &state.ErrorCode, &state.ErrorMessage, &state.AttemptCount, &state.StartedAt, &state.CompletedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return state, ErrNotFound
	}
	return state, err
}

func (s *Store) CompleteAction(ctx context.Context, workspaceID, executionID, actionType, status, outcome, providerResultID, errorCode, errorMessage string) error {
	tag, err := s.DB.Exec(ctx, `UPDATE automation_execution_actions a
		SET status=$4,outcome=NULLIF($5,''),provider_result_id=NULLIF($6,''),error_code=NULLIF($7,''),error_message=NULLIF($8,''),completed_at=now(),updated_at=now()
		FROM automation_executions e WHERE a.execution_id=e.id AND a.workspace_id=$1 AND e.workspace_id=$1 AND a.execution_id=$2 AND a.action_type=$3 AND a.status='sending'`, workspaceID, executionID, actionType, status, outcome, providerResultID, errorCode, errorMessage)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetExecutionFollowStatus(ctx context.Context, workspaceID, executionID string, status domain.FollowerStatus) error {
	tag, err := s.DB.Exec(ctx, `UPDATE automation_executions SET follow_status=$3 WHERE id=$2 AND workspace_id=$1`, workspaceID, executionID, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RecordPrivateReplyMessage(ctx context.Context, workspaceID string, rule domain.AutomationRule, event domain.CommentEvent, providerMessageID string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	participant := event.ParticipantID
	if participant == "" {
		participant = "commenter:" + event.CommentID
	}
	username := strings.TrimSpace(event.Username)
	if username == "" {
		username = participant
	}
	var conversationID string
	err = tx.QueryRow(ctx, `INSERT INTO conversations(workspace_id,instagram_account_id,participant_id,participant_username,last_message_at)
		VALUES($1,$2,$3,$4,now()) ON CONFLICT(workspace_id,instagram_account_id,participant_id) DO UPDATE SET participant_username=EXCLUDED.participant_username,last_message_at=now() RETURNING id`, workspaceID, rule.InstagramAccountID, participant, username).Scan(&conversationID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO messages(conversation_id,provider_message_id,direction,message_text,status)
		VALUES($1,$2,'outbound',$3,'sent') ON CONFLICT(provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING`, conversationID, providerMessageID, rule.PrivateReplyText)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) FinishExecution(ctx context.Context, workspaceID, executionID, status, errorCode, errorMessage string, processed bool) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var eventID string
	err = tx.QueryRow(ctx, `UPDATE automation_executions SET status=$3,error_code=NULLIF($4,''),error_message=NULLIF($5,''),completed_at=CASE WHEN $6 THEN now() ELSE NULL END
		WHERE id=$2 AND workspace_id=$1 RETURNING event_id`, workspaceID, executionID, status, errorCode, errorMessage, processed).Scan(&eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if processed {
		webhookStatus := "processed"
		if status == "failed" || status == "delivery_state_unknown" {
			webhookStatus = "failed"
		}
		if _, err = tx.Exec(ctx, `UPDATE webhook_events SET processing_status=$3,error_code=NULLIF($4,''),processed_at=now(),leased_at=NULL WHERE id=$1 AND workspace_id=$2`, eventID, workspaceID, webhookStatus, errorCode); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// RecordInboundMessage stores a verified provider message idempotently and
// opens (or extends) the manual reply window. No other event type may update
// can_reply_until.
func (s *Store) RecordInboundMessage(ctx context.Context, provider string, event domain.InboundMessageEvent) (workspaceID, accountID string, inserted bool, err error) {
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
	err = tx.QueryRow(ctx, `INSERT INTO messages(conversation_id,provider_message_id,direction,message_text,status,created_at)
		VALUES($1,$2,'inbound',$3,'received',$4)
		ON CONFLICT(provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING RETURNING id`, conversationID, event.ProviderMessageID, event.Text, event.CreatedAt).Scan(&messageID)
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

func (s *Store) ExecutionHistory(ctx context.Context, workspaceID, ruleID string, limit int) ([]domain.AutomationExecution, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := s.DB.Query(ctx, `SELECT e.id,COALESCE(e.rule_id::text,''),COALESCE(w.payload_redacted->>'comment_id',''),COALESCE(w.payload_redacted->>'text',''),COALESCE(w.payload_redacted->>'username',''),e.status,e.follow_status,COALESCE(e.error_code,''),COALESCE(e.error_message,''),w.received_at,e.completed_at
		FROM automation_executions e JOIN webhook_events w ON w.id=e.event_id
		WHERE e.workspace_id=$1 AND e.rule_id=$2 ORDER BY w.received_at DESC LIMIT $3`, workspaceID, ruleID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.AutomationExecution{}
	for rows.Next() {
		var item domain.AutomationExecution
		if err = rows.Scan(&item.ID, &item.RuleID, &item.CommentID, &item.CommentText, &item.Username, &item.Status, &item.FollowStatus, &item.ErrorCode, &item.ErrorMessage, &item.ReceivedAt, &item.CompletedAt); err != nil {
			return nil, err
		}
		item.Actions = []domain.ExecutionAction{}
		actionRows, queryErr := s.DB.Query(ctx, `SELECT action_type,status,COALESCE(message_text,''),COALESCE(outcome,''),COALESCE(provider_result_id,''),COALESCE(error_code,''),COALESCE(error_message,''),attempt_count,started_at,completed_at
			FROM automation_execution_actions WHERE workspace_id=$1 AND execution_id=$2 ORDER BY started_at`, workspaceID, item.ID)
		if queryErr != nil {
			return nil, queryErr
		}
		for actionRows.Next() {
			var action domain.ExecutionAction
			if queryErr = actionRows.Scan(&action.ActionType, &action.Status, &action.MessageText, &action.Outcome, &action.ProviderResultID, &action.ErrorCode, &action.ErrorMessage, &action.AttemptCount, &action.StartedAt, &action.CompletedAt); queryErr != nil {
				actionRows.Close()
				return nil, queryErr
			}
			item.Actions = append(item.Actions, action)
		}
		queryErr = actionRows.Err()
		actionRows.Close()
		if queryErr != nil {
			return nil, queryErr
		}
		items = append(items, item)
	}
	return items, rows.Err()
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
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) Conversations(ctx context.Context, workspaceID, search string) ([]Conversation, error) {
	rows, err := s.DB.Query(ctx, `SELECT c.id,a.username,c.participant_username,c.status,c.unread_count,c.can_reply_until,c.last_message_at,COALESCE((SELECT message_text FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1),'') FROM conversations c JOIN instagram_accounts a ON a.id=c.instagram_account_id WHERE c.workspace_id=$1 AND a.provider<>'mock' AND ($2='' OR c.participant_username ILIKE '%'||$2||'%') ORDER BY c.last_message_at DESC LIMIT 100`, workspaceID, search)
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
	rows, err := s.DB.Query(ctx, `SELECT m.id,m.direction,m.message_text,m.status,m.created_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND c.id=$2 ORDER BY m.created_at`, workspaceID, conversationID)
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

func (s *Store) ConversationForReply(ctx context.Context, workspaceID, conversationID string) (accountID, participantID string, canReplyUntil *time.Time, err error) {
	err = s.DB.QueryRow(ctx, `SELECT instagram_account_id,participant_id,can_reply_until FROM conversations WHERE workspace_id=$1 AND id=$2`, workspaceID, conversationID).Scan(&accountID, &participantID, &canReplyUntil)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

// BeginManualMessage commits the browser idempotency key before any provider
// call. A duplicate request returns acquired=false and must never be resent.
func (s *Store) BeginManualMessage(ctx context.Context, workspaceID, conversationID, clientRequestID, text string) (messageID string, acquired bool, err error) {
	err = s.DB.QueryRow(ctx, `INSERT INTO messages(conversation_id,client_request_id,direction,message_text,status)
		SELECT id,$3,'outbound',$4,'sending' FROM conversations WHERE workspace_id=$1 AND id=$2
		ON CONFLICT(conversation_id,client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING RETURNING id`, workspaceID, conversationID, clientRequestID, text).Scan(&messageID)
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
	err := s.DB.QueryRow(ctx, `SELECT count(DISTINCT w.id),count(DISTINCT e.id) FILTER(WHERE e.rule_id IS NOT NULL),count(DISTINCT a.execution_id) FILTER(WHERE a.action_type='private_reply' AND a.status='succeeded'),count(DISTINCT w.id) FILTER(WHERE w.processing_status='failed') FROM webhook_events w JOIN instagram_accounts ia ON ia.id=w.instagram_account_id AND ia.provider<>'mock' LEFT JOIN automation_executions e ON e.event_id=w.id LEFT JOIN automation_execution_actions a ON a.execution_id=e.id WHERE w.workspace_id=$1 AND w.received_at BETWEEN $2 AND $3`, workspaceID, from, to).Scan(&m.Comments, &m.EligibleTriggers, &m.RepliesSent, &m.Failures)
	if err != nil {
		return m, err
	}
	if m.Comments > 0 {
		m.Conversion = float64(m.RepliesSent) * 100 / float64(m.Comments)
	}
	rows, err := s.DB.Query(ctx, `SELECT to_char(d,'DD Mon'),count(DISTINCT w.id),count(DISTINCT a.execution_id) FILTER(WHERE a.action_type='private_reply' AND a.status='succeeded') FROM generate_series($2::date,$3::date,interval '1 day') d LEFT JOIN webhook_events w ON w.workspace_id=$1 AND w.received_at::date=d::date AND EXISTS(SELECT 1 FROM instagram_accounts ia WHERE ia.id=w.instagram_account_id AND ia.provider<>'mock') LEFT JOIN automation_executions e ON e.event_id=w.id LEFT JOIN automation_execution_actions a ON a.execution_id=e.id GROUP BY d ORDER BY d`, workspaceID, from, to)
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

func (s *Store) Settings(ctx context.Context, p domain.Principal) (map[string]any, error) {
	var webhookFailures, queued int
	var language string
	var notifications bool
	_ = s.DB.QueryRow(ctx, `SELECT preferred_language,notifications_enabled FROM users WHERE id=$1`, p.UserID).Scan(&language, &notifications)
	_ = s.DB.QueryRow(ctx, `SELECT count(*) FILTER(WHERE w.processing_status='failed' AND w.received_at>now()-interval '24 hours'),count(*) FILTER(WHERE w.processing_status='queued') FROM webhook_events w JOIN instagram_accounts a ON a.id=w.instagram_account_id AND a.provider<>'mock' WHERE w.workspace_id=$1`, p.WorkspaceID).Scan(&webhookFailures, &queued)
	return map[string]any{"profile": map[string]any{"name": p.Name, "email": p.Email, "login_provider": p.LoginProvider}, "workspace": map[string]any{"id": p.WorkspaceID, "name": p.Workspace, "role": p.Role}, "webhook": map[string]any{"failed_last_24h": webhookFailures, "queued": queued}, "language": language, "notifications_enabled": notifications}, nil
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

func (s *Store) DebugCounts(ctx context.Context) string {
	var users int
	_ = s.DB.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&users)
	return fmt.Sprintf("users=%d", users)
}
