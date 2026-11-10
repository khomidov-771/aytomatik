//go:build integration

package store_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	postgres "github.com/fergusstrange/embedded-postgres/v2"
	"github.com/fergusstrange/embedded-postgres/v2/eptest"
	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/migrations"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func testStore(t *testing.T) *store.Store {
	t.Helper()
	dsn := os.Getenv("IDS_TEST_DATABASE_URL")
	if dsn == "" {
		cacheDir := os.Getenv("IDS_EMBEDDED_POSTGRES_CACHE")
		if cacheDir == "" {
			cacheDir = filepath.Join(os.TempDir(), "ids-embedded-postgres-cache")
		}
		workDir := os.Getenv("IDS_EMBEDDED_POSTGRES_WORK_DIR")
		if workDir == "" {
			workDir = t.TempDir()
		}
		config := postgres.DefaultConfig().Port(0).Database("ids_test").StartTimeout(10 * time.Minute).Storage(postgres.Storage{
			CacheDir: cacheDir,
			WorkDir:  workDir,
		}).Provider(postgres.DownloadProvider{CacheDir: cacheDir, Client: &http.Client{Timeout: 10 * time.Minute}})
		dsn = eptest.Start(t, config).ConnectionURL()
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("ids_test_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err = migrations.Up(ctx, pool); err != nil {
		pool.Close()
		_, _ = admin.Exec(ctx, "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
	})
	return &store.Store{DB: pool}
}

func TestGoogleLoginStateAndIdentityLinking(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	state := store.GoogleLoginState{Nonce: "nonce-value", CodeVerifier: "verifier-value", Intent: "register", AcceptTerms: true, RememberMe: true}
	if err := s.SaveGoogleLoginState(ctx, []byte("google-state"), state, time.Now().Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	gotState, err := s.ConsumeGoogleLoginState(ctx, []byte("google-state"))
	if err != nil || gotState != state {
		t.Fatalf("Google state binding failed: %#v %v", gotState, err)
	}
	if _, err = s.ConsumeGoogleLoginState(ctx, []byte("google-state")); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("Google state could be reused: %v", err)
	}

	created, err := s.CompleteGoogleLogin(ctx, "google-subject-1", "New.User@example.com", "New User", "opaque-bcrypt-hash", true)
	if err != nil || created.Role != "owner" || created.WorkspaceID == "" || created.Email != "new.user@example.com" {
		t.Fatalf("Google registration did not create its own tenant: %#v %v", created, err)
	}
	returned, err := s.CompleteGoogleLogin(ctx, "google-subject-1", "changed@example.com", "Changed Name", "unused", false)
	if err != nil || returned.UserID != created.UserID || returned.Email != created.Email {
		t.Fatalf("existing Google subject did not resolve to the linked user: %#v %v", returned, err)
	}
	if _, err = s.CompleteGoogleLogin(ctx, "unknown-google-subject", "missing@example.com", "Missing", "unused", false); !errors.Is(err, store.ErrGoogleAccountNotFound) {
		t.Fatalf("login intent created an unregistered account: %v", err)
	}

	local, _, err := s.Register(ctx, "Local User", "local@example.com", "already-hashed")
	if err != nil {
		t.Fatal(err)
	}
	linked, err := s.CompleteGoogleLogin(ctx, "google-subject-2", local.Email, "Provider Name", "unused", false)
	if err != nil || linked.UserID != local.UserID {
		t.Fatalf("verified Google email did not link to its existing account: %#v %v", linked, err)
	}
	_, _, _, _, _, _, _, verified, err := s.LoginUser(ctx, local.Email)
	if err != nil || !verified {
		t.Fatalf("verified Google identity did not verify local account email: verified=%v err=%v", verified, err)
	}
	if _, err = s.CompleteGoogleLogin(ctx, "google-subject-3", local.Email, "Other", "unused", true); !errors.Is(err, store.ErrGoogleIdentityConflict) {
		t.Fatalf("a second Google identity was linked to the same user: %v", err)
	}
}

func TestTenantTokensInboxAndQueue(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	alice, aliceID, err := s.Register(ctx, "Alice", "alice@example.com", "hash")
	if err != nil {
		t.Fatal(err)
	}
	bob, bobID, err := s.Register(ctx, "Bob", "bob@example.com", "hash")
	if err != nil {
		t.Fatal(err)
	}
	created, err := s.CreateOneTimeToken(ctx, alice.Email, "email_verify", []byte("verify-hash"), time.Now().Add(time.Hour))
	if err != nil || !created {
		t.Fatalf("verification token: created=%v err=%v", created, err)
	}
	if err = s.VerifyEmail(ctx, []byte("verify-hash")); err != nil {
		t.Fatal(err)
	}
	if err = s.VerifyEmail(ctx, []byte("verify-hash")); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("verification token was reusable: %v", err)
	}
	if err = s.SaveOAuthState(ctx, alice, []byte("oauth-state-hash"), time.Now().Add(10*time.Minute)); err != nil {
		t.Fatal(err)
	}
	workspaceID, oauthUserID, err := s.ConsumeOAuthState(ctx, []byte("oauth-state-hash"))
	if err != nil || workspaceID != alice.WorkspaceID || oauthUserID != aliceID {
		t.Fatalf("OAuth state binding failed: workspace=%q user=%q err=%v", workspaceID, oauthUserID, err)
	}
	if _, _, err = s.ConsumeOAuthState(ctx, []byte("oauth-state-hash")); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("OAuth state was reusable: %v", err)
	}

	if err = s.CreateInvitation(ctx, alice, bob.Email, "customer", []byte("invitation-hash"), time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err = s.AcceptInvitation(ctx, bob, []byte("invitation-hash")); err != nil {
		t.Fatal(err)
	}
	if err = s.UpdateMemberRole(ctx, alice, bobID, "operator"); err != nil {
		t.Fatal(err)
	}
	members, err := s.Members(ctx, alice.WorkspaceID)
	if err != nil || len(members) != 2 {
		t.Fatalf("expected owner and invited member: %#v %v", members, err)
	}
	if err = s.UpdateMemberRole(ctx, alice, aliceID, "manager"); !errors.Is(err, store.ErrOwnerProtected) {
		t.Fatalf("owner role was not protected: %v", err)
	}
	if err = s.RemoveMember(ctx, alice, bobID); err != nil {
		t.Fatal(err)
	}
	members, err = s.Members(ctx, alice.WorkspaceID)
	if err != nil || len(members) != 1 || members[0].ID != aliceID {
		t.Fatalf("member removal failed: %#v %v", members, err)
	}

	account := store.AccountInput{InstagramUserID: "ig-unique", Username: "alice.ig", AccountType: "BUSINESS", TokenCiphertext: "encrypted", Provider: "meta", Scopes: []string{"instagram_business_manage_comments", "instagram_business_manage_messages"}}
	if err = s.UpsertInstagramAccount(ctx, alice.WorkspaceID, aliceID, account); err != nil {
		t.Fatal(err)
	}
	if err = s.UpsertInstagramAccount(ctx, bob.WorkspaceID, bob.UserID, account); !errors.Is(err, store.ErrAccountClaimed) {
		t.Fatalf("second tenant claimed same provider account: %v", err)
	}
	accounts, err := s.ListInstagramAccounts(ctx, alice.WorkspaceID)
	if err != nil || len(accounts) != 1 {
		t.Fatalf("alice accounts: %#v %v", accounts, err)
	}
	if _, _, _, _, err = s.AccountSecretByID(ctx, bob.WorkspaceID, accounts[0].ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("cross-tenant account lookup succeeded: %v", err)
	}

	inbound := domain.InboundMessageEvent{ProviderEventID: "message:mid-1", AccountID: "ig-unique", ProviderMessageID: "mid-1", ParticipantID: "customer-1", Username: "customer", Text: "Salom", CreatedAt: time.Now()}
	_, _, inserted, err := s.RecordInboundMessage(ctx, "meta", inbound)
	if err != nil || !inserted {
		t.Fatalf("inbound insert: inserted=%v err=%v", inserted, err)
	}
	_, _, inserted, err = s.RecordInboundMessage(ctx, "meta", inbound)
	if err != nil || inserted {
		t.Fatalf("inbound idempotency: inserted=%v err=%v", inserted, err)
	}
	conversations, err := s.Conversations(ctx, alice.WorkspaceID, "")
	if err != nil || len(conversations) != 1 || conversations[0].CanReplyUntil == nil || conversations[0].UnreadCount != 1 {
		t.Fatalf("reply window was not opened exactly once: %#v %v", conversations, err)
	}

	comment := domain.CommentEvent{ProviderEventID: "comment:c1", AccountID: "ig-unique", CommentID: "c1", MediaID: "m1", Text: "narx", ParticipantID: "customer-1", CreatedAt: time.Now()}
	eventID, _, _, inserted, err := s.EnqueueEvent(ctx, "meta", comment)
	if err != nil || !inserted {
		t.Fatalf("queue insert: %v %v", inserted, err)
	}
	queued, err := s.ClaimQueuedEvent(ctx, eventID, 5)
	if err != nil || queued.Event.CommentID != "c1" || queued.WorkspaceID != alice.WorkspaceID {
		t.Fatalf("queue claim: %#v %v", queued, err)
	}
	// A rule is required by the execution and action ledger foreign keys.
	rule, err := s.CreateRule(ctx, alice, domain.AutomationRule{
		Name: "Narx", InstagramAccountID: accounts[0].ID, MatchMode: "contains", Keywords: []string{"narx"}, MediaScope: "all",
		PrivateReplyText: "DM", PublicSuccessReplyText: "Direct xabaringizga yubordik!", PublicNotFollowerReplyText: "Avval sahifamizga obuna bo‘ling!",
		PublicUnknownReplyText: "Sahifani kuzatib, Direct orqali yozing.", FollowVerificationEnabled: true, UnknownFallbackPolicy: "skip_dm_neutral_reply",
		IsActive: true, Priority: 100,
	})
	if err != nil {
		t.Fatal(err)
	}
	executionID, followStatus, err := s.EnsureExecution(ctx, eventID, alice.WorkspaceID, rule.ID)
	if err != nil || executionID == "" || followStatus != domain.FollowerNotChecked {
		t.Fatalf("execution marker: id=%q follow=%q err=%v", executionID, followStatus, err)
	}
	if _, _, err = s.EnsureExecution(ctx, eventID, bob.WorkspaceID, rule.ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("cross-tenant execution was not rejected: %v", err)
	}
	if err = s.SetExecutionFollowStatus(ctx, alice.WorkspaceID, executionID, domain.Follower); err != nil {
		t.Fatal(err)
	}
	privateState, acquired, err := s.BeginAction(ctx, alice.WorkspaceID, executionID, "private_reply", rule.PrivateReplyText, false)
	if err != nil || !acquired || privateState.AttemptCount != 1 {
		t.Fatalf("first private action: state=%#v acquired=%v err=%v", privateState, acquired, err)
	}
	_, acquired, err = s.BeginAction(ctx, alice.WorkspaceID, executionID, "private_reply", rule.PrivateReplyText, false)
	if err != nil || acquired {
		t.Fatalf("duplicate private action: acquired=%v err=%v", acquired, err)
	}
	if err = s.CompleteAction(ctx, alice.WorkspaceID, executionID, "private_reply", "succeeded", "sent", "private-id", "", ""); err != nil {
		t.Fatal(err)
	}
	publicState, acquired, err := s.BeginAction(ctx, alice.WorkspaceID, executionID, "public_reply", rule.PublicSuccessReplyText, true)
	if err != nil || !acquired || publicState.MessageText != rule.PublicSuccessReplyText {
		t.Fatalf("first public action: state=%#v acquired=%v err=%v", publicState, acquired, err)
	}
	if err = s.CompleteAction(ctx, alice.WorkspaceID, executionID, "public_reply", "failed_retryable", "", "", "rate_limited", "retry later"); err != nil {
		t.Fatal(err)
	}
	publicState, acquired, err = s.BeginAction(ctx, alice.WorkspaceID, executionID, "public_reply", "changed template must not replace stored text", true)
	if err != nil || !acquired || publicState.AttemptCount != 2 || publicState.MessageText != rule.PublicSuccessReplyText {
		t.Fatalf("safe public retry: state=%#v acquired=%v err=%v", publicState, acquired, err)
	}
	if err = s.CompleteAction(ctx, alice.WorkspaceID, executionID, "public_reply", "succeeded", "sent", "public-id", "", ""); err != nil {
		t.Fatal(err)
	}
	if _, _, err = s.BeginAction(ctx, bob.WorkspaceID, executionID, "public_reply", "cross tenant", true); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("cross-tenant action was not rejected: %v", err)
	}
	if err = s.FinishExecution(ctx, alice.WorkspaceID, executionID, "succeeded", "", "", true); err != nil {
		t.Fatal(err)
	}
	history, err := s.ExecutionHistory(ctx, alice.WorkspaceID, rule.ID, 10)
	if err != nil || len(history) != 1 || history[0].FollowStatus != domain.Follower || history[0].Status != "succeeded" || len(history[0].Actions) != 2 {
		t.Fatalf("execution history: %#v err=%v", history, err)
	}

	// Historical/test-provider rows must remain preserved without appearing in
	// product account lists, Inbox counters or analytics.
	if err = s.UpsertInstagramAccount(ctx, alice.WorkspaceID, aliceID, store.AccountInput{InstagramUserID: "mock-hidden", Username: "hidden.fixture", AccountType: "BUSINESS", TokenCiphertext: "test-only", Provider: "mock"}); err != nil {
		t.Fatal(err)
	}
	accounts, err = s.ListInstagramAccounts(ctx, alice.WorkspaceID)
	if err != nil || len(accounts) != 1 || accounts[0].Provider != "meta" {
		t.Fatalf("test-provider account leaked into product list: %#v %v", accounts, err)
	}
	_, _, _, inserted, err = s.EnqueueEvent(ctx, "mock", domain.CommentEvent{ProviderEventID: "comment:mock-hidden", AccountID: "mock-hidden", CommentID: "mock-hidden", MediaID: "m2", Text: "narx", ParticipantID: "fixture", CreatedAt: time.Now()})
	if err != nil || !inserted {
		t.Fatalf("test-only event setup failed: inserted=%v err=%v", inserted, err)
	}
	metrics, err := s.Metrics(ctx, alice.WorkspaceID, time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	if err != nil || metrics.Comments != 1 || metrics.EligibleTriggers != 1 || metrics.RepliesSent != 1 {
		t.Fatalf("product metrics included test-provider data: %#v %v", metrics, err)
	}
	settings, err := s.Settings(ctx, alice)
	if err != nil {
		t.Fatal(err)
	}
	webhook, ok := settings["webhook"].(map[string]any)
	if !ok || webhook["queued"] != 0 {
		t.Fatalf("test-provider queue leaked into settings: %#v", settings)
	}

	conversationID := conversations[0].ID
	messageID, acquired, err := s.BeginManualMessage(ctx, alice.WorkspaceID, conversationID, "550e8400-e29b-41d4-a716-446655440000", "Manual")
	if err != nil || !acquired {
		t.Fatalf("manual message marker: acquired=%v err=%v", acquired, err)
	}
	duplicateID, acquired, err := s.BeginManualMessage(ctx, alice.WorkspaceID, conversationID, "550e8400-e29b-41d4-a716-446655440000", "Manual")
	if err != nil || acquired || duplicateID != messageID {
		t.Fatalf("manual message duplicate: id=%q acquired=%v err=%v", duplicateID, acquired, err)
	}
	if err = s.CompleteManualMessage(ctx, alice.WorkspaceID, conversationID, messageID, "sent", "manual-provider-id"); err != nil {
		t.Fatal(err)
	}
	messages, err := s.Messages(ctx, alice.WorkspaceID, conversationID)
	if err != nil || len(messages) != 2 {
		t.Fatalf("manual delivery should create exactly one outbound record: %#v %v", messages, err)
	}
}
