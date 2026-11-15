//go:build integration

package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/provider"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/testdb"
	"github.com/ids-automate/ids-automate/api/internal/worker"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// Parse and verify with the official-format Meta adapter; only outbound delivery
// is controlled, so the fixture cannot send messages to external accounts.
type controlledDelivery struct{ provider.Instagram }

func (controlledDelivery) SendPrivateReply(context.Context, string, string, string, string) (provider.Delivery, error) {
	return provider.Delivery{MessageID: "test-private"}, nil
}
func (controlledDelivery) SendPublicCommentReply(context.Context, string, string, string) (provider.Delivery, error) {
	return provider.Delivery{MessageID: "test-public"}, nil
}

func TestSmartAutomationHTTPAndSignedWebhook(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	db := &store.Store{DB: testdb.Open(t)}
	cfg := config.Config{Env: "test", InstagramProvider: "meta", WebhookAppSecret: "integration-test-secret"}
	cipher, err := security.NewTokenCipher(make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	token, err := cipher.Encrypt("integration-fixture")
	if err != nil {
		t.Fatal(err)
	}
	createOwner := func(id string) (domain.Principal, string) {
		t.Helper()
		user, _, err := db.CompleteInstagramLogin(ctx, store.AccountInput{InstagramUserID: id, Username: id, Provider: "meta", LoginMode: "instagram", TokenCiphertext: token, AccountType: "BUSINESS"}, "fixture", "register", time.Now())
		if err != nil {
			t.Fatal(err)
		}
		if err = db.CreateSession(ctx, user, security.TokenHash(id), "test-csrf", time.Now().Add(time.Hour)); err != nil {
			t.Fatal(err)
		}
		accounts, err := db.ListInstagramAccounts(ctx, user.WorkspaceID)
		if err != nil || len(accounts) != 1 {
			t.Fatal(accounts, err)
		}
		return user, accounts[0].ID
	}
	owner, account := createOwner("shop")
	createOwner("other")
	p := controlledDelivery{provider.New(cfg)}
	w := worker.New(ctx, db, p, cipher, "")
	w.Start(ctx)
	api := New(cfg, db, p, cipher, w).Handler()
	req := func(method, path, body, session, csrf string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/v1"+path, strings.NewReader(body))
		if session != "" {
			r.AddCookie(&http.Cookie{Name: "ids_session", Value: session})
		}
		if csrf != "" {
			r.Header.Set("X-CSRF-Token", csrf)
		}
		resp := httptest.NewRecorder()
		api.ServeHTTP(resp, r)
		return resp
	}
	group := domain.KeywordGroup{Name: "Narx", Priority: 1, Enabled: true, Variants: []domain.KeywordVariant{{Kind: "primary", Text: "narx", Enabled: true}}, DMTemplates: []domain.ReplyTemplate{{Text: "42", Enabled: true}}, PublicTemplates: []domain.ReplyTemplate{{Text: "Check Direct", Enabled: true}}}
	raw, err := json.Marshal(domain.AutomationRule{InstagramAccountID: account, Name: "Price", IsActive: true, MediaScope: "all", MatchMode: "keyword_list", Priority: 100, KeywordGroups: []domain.KeywordGroup{group}})
	if err != nil {
		t.Fatal(err)
	}
	path := "/automations"
	if got := req("POST", path, string(raw), "", ""); got.Code != 401 {
		t.Fatal(got.Code)
	}
	if got := req("POST", path, string(raw), "shop", "wrong"); got.Code != 403 {
		t.Fatal(got.Code)
	}
	saved := req("POST", path, string(raw), "shop", "test-csrf")
	if saved.Code != 201 {
		t.Fatal(saved.Code, saved.Body.String())
	}
	var rule domain.AutomationRule
	if err = json.Unmarshal(saved.Body.Bytes(), &rule); err != nil {
		t.Fatal(err)
	}
	if got := req("PATCH", path+"/"+rule.ID, "{}", "other", "test-csrf"); got.Code != 404 {
		t.Fatal(got.Code, got.Body.String())
	}
	preview, _ := json.Marshal(map[string]any{"text": "НАРХ?", "match_mode": "keyword_list", "keyword_groups": rule.KeywordGroups})
	resp := req("POST", path+"/match-preview", string(preview), "shop", "test-csrf")
	var result struct {
		Matched bool
		Sends   bool                  `json:"sends_message"`
		Matches []domain.KeywordMatch `json:"keyword_matches"`
	}
	if resp.Code != 200 || json.Unmarshal(resp.Body.Bytes(), &result) != nil || !result.Matched || result.Sends || len(result.Matches) != 1 || result.Matches[0].GroupID != rule.KeywordGroups[0].ID {
		t.Fatal(resp.Code, resp.Body.String())
	}
	payload := fmt.Sprintf(`{"object":"instagram","entry":[{"id":"shop","time":%d,"changes":[{"field":"comments","value":{"id":"comment-1","text":"НАРХ?","media":{"id":"post"},"from":{"id":"reader"}}}]}]}`, time.Now().Unix())
	mac := hmac.New(sha256.New, []byte(cfg.WebhookAppSecret))
	mac.Write([]byte(payload))
	for attempt, signature := range []string{"bad", "sha256=" + hex.EncodeToString(mac.Sum(nil)), "sha256=" + hex.EncodeToString(mac.Sum(nil))} {
		r := httptest.NewRequest("POST", "/api/v1/webhooks/instagram", strings.NewReader(payload))
		r.Header.Set("X-Hub-Signature-256", signature)
		resp := httptest.NewRecorder()
		api.ServeHTTP(resp, r)
		if attempt == 0 {
			if resp.Code != 401 {
				t.Fatal(resp.Code)
			}
			continue
		}
		expected := 1
		if attempt == 2 {
			expected = 0
		}
		var body struct{ Accepted int }
		if resp.Code != 202 || json.Unmarshal(resp.Body.Bytes(), &body) != nil || body.Accepted != expected {
			t.Fatal(resp.Code, resp.Body.String())
		}
	}
	for end := time.Now().Add(8 * time.Second); time.Now().Before(end); {
		history, err := db.ExecutionHistory(ctx, owner.WorkspaceID, rule.ID, 5)
		if err != nil {
			t.Fatal(err)
		}
		if len(history) == 1 && history[0].CompletedAt != nil {
			if history[0].Status != "completed" || len(history[0].Matches) != 1 || len(history[0].Actions) != 3 {
				t.Fatal(history)
			}
			return
		}
		time.Sleep(30 * time.Millisecond)
	}
	t.Fatal("signed webhook did not complete")
}
