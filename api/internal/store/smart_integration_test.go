//go:build integration

package store_test

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/provider"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/worker"
)

// Only the external transport is substituted. Two actual workers claim the
// same persisted webhook, run the matcher, and write the normal action ledger.
type recordedProvider struct {
	provider.Instagram
	mu                         sync.Mutex
	calls                      []string
	rejectPrivate, retryPublic bool
}

func (*recordedProvider) Name() string { return "meta" }
func (p *recordedProvider) SendPrivateReply(_ context.Context, _, _, _, text string) (provider.Delivery, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls = append(p.calls, "DM "+text)
	if p.rejectPrivate {
		return provider.Delivery{}, &provider.APIError{StatusCode: 403, Code: 10}
	}
	return provider.Delivery{MessageID: "private-result"}, nil
}
func (p *recordedProvider) SendPublicCommentReply(_ context.Context, _, _, text string) (provider.Delivery, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls = append(p.calls, "public "+text)
	if p.retryPublic {
		p.retryPublic = false
		return provider.Delivery{}, &provider.APIError{StatusCode: 429, Code: 4, Retryable: true}
	}
	return provider.Delivery{MessageID: "public-result"}, nil
}
func smartOwner(t *testing.T, s *store.Store, name string) (domain.Principal, string, *security.TokenCipher) {
	t.Helper()
	ctx := context.Background()
	p, _, err := s.Register(ctx, name, name+"@example.com", "fixture")
	if err != nil {
		t.Fatal(err)
	}
	cipher, err := security.NewTokenCipher(make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	token, err := cipher.Encrypt("test-provider-token")
	if err != nil {
		t.Fatal(err)
	}
	if err = s.UpsertInstagramAccount(ctx, p.WorkspaceID, p.UserID, store.AccountInput{InstagramUserID: name, Username: name, Provider: "meta", AccountType: "BUSINESS", TokenCiphertext: token, Scopes: []string{"instagram_business_manage_comments", "instagram_business_manage_messages"}}); err != nil {
		t.Fatal(err)
	}
	accounts, err := s.ListInstagramAccounts(ctx, p.WorkspaceID)
	if err != nil || len(accounts) != 1 {
		t.Fatal(accounts, err)
	}
	return p, accounts[0].ID, cipher
}
func groupedRule(account string) domain.AutomationRule {
	g := domain.KeywordGroup{Name: "Price", Priority: 10, Enabled: true, Variants: []domain.KeywordVariant{{Text: "narx", Kind: "primary", Enabled: true}}, DMTemplates: []domain.ReplyTemplate{{Text: "Price {{price}}", Enabled: true}}, PublicTemplates: []domain.ReplyTemplate{{Text: "Check Direct", Enabled: true}}, Variables: map[string]string{"price": "42"}}
	delivery := domain.KeywordGroup{Name: "Delivery", Priority: 20, Enabled: true, Variants: []domain.KeywordVariant{{Text: "dostavka", Kind: "primary", Enabled: true}}, DMTemplates: []domain.ReplyTemplate{{Text: "Delivery info", Enabled: true}}}
	return domain.AutomationRule{InstagramAccountID: account, Name: "Grouped rule", MatchMode: "keyword_list", MediaScope: "all", Priority: 20, IsActive: true, CombineGroupReplies: true, KeywordGroups: []domain.KeywordGroup{g, delivery}}
}
func TestSmartGroupIsolation(t *testing.T) {
	ctx := context.Background()
	s := testStore(t)
	a, accA, _ := smartOwner(t, s, "alice")
	b, accB, _ := smartOwner(t, s, "bob")
	one, err := s.CreateRule(ctx, a, groupedRule(accA))
	if err != nil {
		t.Fatal(err)
	}
	two, err := s.CreateRule(ctx, b, groupedRule(accB))
	if err != nil {
		t.Fatal(err)
	}
	for _, level := range []string{"rule", "group", "variant", "template"} {
		t.Run(level, func(t *testing.T) {
			r, err := s.GetRule(ctx, b.WorkspaceID, two.ID)
			if err != nil {
				t.Fatal(err)
			}
			foreign := one.KeywordGroups[0]
			g := &r.KeywordGroups[0]
			switch level {
			case "rule":
				r = one
			case "group":
				g.ID = foreign.ID
			case "variant":
				g.Variants[0].ID = foreign.Variants[0].ID
			case "template":
				g.DMTemplates[0].ID = foreign.DMTemplates[0].ID
			}
			if _, err = s.UpdateRule(ctx, b, r); !errors.Is(err, store.ErrNotFound) {
				t.Fatalf("foreign %s accepted: %v", level, err)
			}
			current, err := s.GetRule(ctx, b.WorkspaceID, two.ID)
			if err != nil || !current.UpdatedAt.Equal(two.UpdatedAt) {
				t.Fatalf("failed write did not roll back: %v", err)
			}
		})
	}
	list, err := s.ActiveRules(ctx, a.WorkspaceID, accA)
	if err != nil || len(list) != 1 || len(list[0].KeywordGroups) != 2 || len(list[0].KeywordGroups[0].DMTemplates) > 0 {
		t.Fatalf("candidate projection %+v, %v", list, err)
	}
}
func TestSmartWorkerPostgres(t *testing.T) {
	for _, scenario := range []string{"success", "private_rejected", "public_retry_after_edit", "empty_public"} {
		t.Run(scenario, func(t *testing.T) {
			s := testStore(t)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			owner, account, cipher := smartOwner(t, s, "shop")
			r := groupedRule(account)
			if scenario == "empty_public" {
				r.KeywordGroups[0].PublicTemplates = nil
			}
			rule, err := s.CreateRule(ctx, owner, r)
			if err != nil {
				t.Fatal(err)
			}
			event := domain.CommentEvent{ProviderEventID: "comment:1", AccountID: "shop", CommentID: "1", MediaID: "post", Text: "НАРХ va dostavka?", ParticipantID: "commenter", CreatedAt: time.Now()}
			id, _, _, inserted, err := s.EnqueueEvent(ctx, "meta", event)
			if err != nil || !inserted {
				t.Fatal(inserted, err)
			}
			if _, _, _, inserted, err = s.EnqueueEvent(ctx, "meta", event); err != nil || inserted {
				t.Fatalf("duplicate accepted %v %v", inserted, err)
			}
			transport := &recordedProvider{rejectPrivate: scenario == "private_rejected", retryPublic: scenario == "public_retry_after_edit"}
			for i := 0; i < 2; i++ {
				w := worker.New(ctx, s, transport, cipher, "")
				w.Start(ctx)
				w.Enqueue(worker.Job{EventID: id})
			}
			var result domain.AutomationExecution
			edited := false
			for end := time.Now().Add(15 * time.Second); time.Now().Before(end); {
				history, err := s.ExecutionHistory(ctx, owner.WorkspaceID, rule.ID, 5)
				if err != nil {
					t.Fatal(err)
				}
				if len(history) > 0 {
					result = history[0]
					if result.CompletedAt != nil {
						break
					}
					if result.Status == "public_reply_retry_pending" && !edited {
						changed, err := s.GetRule(ctx, owner.WorkspaceID, rule.ID)
						if err != nil {
							t.Fatal(err)
						}
						changed.KeywordGroups[0].PublicTemplates = []domain.ReplyTemplate{{Text: "Changed reply", Enabled: true}}
						if _, err = s.UpdateRule(ctx, owner, changed); err != nil {
							t.Fatal(err)
						}
						edited = true
					}
				}
				time.Sleep(25 * time.Millisecond)
			}
			if result.CompletedAt == nil || len(result.Matches) != 2 {
				t.Fatalf("missing result or group evidence %+v", result)
			}
			dm := "Price 42\n\nDelivery info"
			expected := []string{"DM " + dm}
			actions := map[string]domain.ExecutionAction{}
			for _, a := range result.Actions {
				actions[a.ActionType] = a
			}
			private := actions["private_reply"]
			public, hasPublic := actions["public_reply"]
			if private.MessageText != dm || !reflect.DeepEqual(private.TemplateIDs, []string{rule.KeywordGroups[0].DMTemplates[0].ID, rule.KeywordGroups[1].DMTemplates[0].ID}) || private.AttemptCount != 1 {
				t.Fatal(private)
			}
			if scenario == "private_rejected" {
				if hasPublic || private.Status != "failed" || private.ErrorCode == "" || result.Status != "failed" {
					t.Fatal(result)
				}
			} else {
				if private.ProviderResultID != "private-result" || private.Status != "succeeded" || result.Status != "completed" {
					t.Fatal(result)
				}
				if scenario == "empty_public" {
					if public.Status != "skipped" || len(public.TemplateIDs) != 0 {
						t.Fatal(public)
					}
				} else {
					expected = append(expected, "public Check Direct")
					if public.Status != "succeeded" || public.ProviderResultID != "public-result" || !reflect.DeepEqual(public.TemplateIDs, []string{rule.KeywordGroups[0].PublicTemplates[0].ID}) {
						t.Fatal(public)
					}
					if scenario == "public_retry_after_edit" {
						if !edited || public.AttemptCount != 2 {
							t.Fatal(edited, public)
						}
						expected = append(expected, "public Check Direct")
					}
				}
				conv, err := s.Conversations(ctx, owner.WorkspaceID, "")
				if err != nil || len(conv) != 1 || conv[0].LastMessage != dm {
					t.Fatalf("inbox differs from provider text: %+v %v", conv, err)
				}
			}
			transport.mu.Lock()
			defer transport.mu.Unlock()
			if !reflect.DeepEqual(transport.calls, expected) {
				t.Fatalf("%q != %q", transport.calls, expected)
			}
		})
	}
}
