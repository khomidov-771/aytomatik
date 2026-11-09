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

	account := store.AccountInput{InstagramUserID: "ig-unique", Username: "alice.ig", AccountType: "BUSINESS", TokenCiphertext: "encrypted", Provider: "meta"}
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
	if _, _, _, err = s.AccountSecretByID(ctx, bob.WorkspaceID, accounts[0].ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("cross-tenant account lookup succeeded: %v", err)
	}

	inbound := domain.InboundMessageEvent{ProviderEventID: "message:mid-1", AccountID: "ig-unique", ProviderMessageID: "mid-1", ParticipantID: "customer-1", Username: "customer", Text: "Salom", CreatedAt: time.Now()}
	_, _, inserted, err := s.RecordInboundMessage(ctx, "meta", inbound, false)
	if err != nil || !inserted {
		t.Fatalf("inbound insert: inserted=%v err=%v", inserted, err)
	}
	_, _, inserted, err = s.RecordInboundMessage(ctx, "meta", inbound, false)
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
	// A rule is required by the delivery marker foreign key.
	rule, err := s.CreateRule(ctx, alice, domain.AutomationRule{Name: "Narx", InstagramAccountID: accounts[0].ID, MatchMode: "contains", Keywords: []string{"narx"}, MediaScope: "all", ReplyText: "DM", IsActive: true, Priority: 100})
	if err != nil {
		t.Fatal(err)
	}
	acquired, err := s.BeginDelivery(ctx, eventID, alice.WorkspaceID, rule.ID)
	if err != nil || !acquired {
		t.Fatalf("first delivery marker: acquired=%v err=%v", acquired, err)
	}
	acquired, err = s.BeginDelivery(ctx, eventID, alice.WorkspaceID, rule.ID)
	if err != nil || acquired {
		t.Fatalf("duplicate delivery marker: acquired=%v err=%v", acquired, err)
	}
	acquired, err = s.BeginDelivery(ctx, eventID, bob.WorkspaceID, rule.ID)
	if err != nil || acquired {
		t.Fatalf("cross-tenant delivery marker was acquired: acquired=%v err=%v", acquired, err)
	}
	if err = s.CompleteExecution(ctx, eventID, bob.WorkspaceID, &rule, comment, "failed", "", "tenant_test", "", false); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("cross-tenant completion was not rejected: %v", err)
	}

	conversationID := conversations[0].ID
	messageID, acquired, err := s.BeginManualMessage(ctx, alice.WorkspaceID, conversationID, "550e8400-e29b-41d4-a716-446655440000", "Manual", false)
	if err != nil || !acquired {
		t.Fatalf("manual message marker: acquired=%v err=%v", acquired, err)
	}
	duplicateID, acquired, err := s.BeginManualMessage(ctx, alice.WorkspaceID, conversationID, "550e8400-e29b-41d4-a716-446655440000", "Manual", false)
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
