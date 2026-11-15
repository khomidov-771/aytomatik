//go:build integration

package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/provider"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/testdb"
)

type unifiedTestProvider struct{ provider.Instagram }

func (p unifiedTestProvider) ExchangeCode(_ context.Context, code string) (provider.Account, error) {
	if code != "test-code" {
		panic("unexpected test code")
	}
	return provider.Account{ID: "test-instagram-id", Username: "test-shop", AccountType: "UNKNOWN", AccessToken: "controlled-token", LoginMode: "unified", Scopes: []string{"instagram_basic"}}, nil
}

func TestUnifiedLoginWithRegisteredCallback(t *testing.T) {
	db := &store.Store{DB: testdb.Open(t)}
	cfg := config.Config{Env: "production", InstagramProvider: "meta", MetaLoginMode: "unified", MetaAppID: "1234567890", MetaAppSecret: strings.Repeat("s", 32), MetaLoginConfigID: "123456789012", MetaRedirectURI: "https://app.example.test/api/v1/auth/instagram/callback", AppURL: "https://app.example.test", AllowedOrigins: []string{"https://app.example.test"}, CookieSecure: true, ShortSessionTTL: time.Hour}
	cipher, err := security.NewTokenCipher(make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	p := unifiedTestProvider{provider.New(cfg)}
	handler := New(cfg, db, p, cipher, nil).Handler()
	start := httptest.NewRequest(http.MethodPost, "https://app.example.test/api/v1/auth/instagram/start", strings.NewReader(`{"intent":"register","accept_terms":true,"remember_me":false}`))
	start.Header.Set("Origin", "https://app.example.test")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, start)
	if response.Code != 200 {
		t.Fatalf("start status %d: %s", response.Code, response.Body.String())
	}
	var output struct {
		AuthorizationURL string `json:"authorization_url"`
	}
	if err = json.Unmarshal(response.Body.Bytes(), &output); err != nil {
		t.Fatal(err)
	}
	target, err := url.Parse(output.AuthorizationURL)
	if err != nil {
		t.Fatal(err)
	}
	if target.Host != "www.facebook.com" || target.Query().Get("config_id") != cfg.MetaLoginConfigID || target.Query().Get("redirect_uri") != cfg.MetaRedirectURI || target.Query().Get("override_default_response_type") != "true" {
		t.Fatal("wrong Unified authorization URL")
	}
	state := target.Query().Get("state")
	jar, _ := cookiejar.New(nil)
	startURL, _ := url.Parse("https://app.example.test/api/v1/auth/instagram/start")
	callbackURL, _ := url.Parse(cfg.MetaRedirectURI)
	jar.SetCookies(startURL, response.Result().Cookies())
	cookies := jar.Cookies(callbackURL)
	if len(cookies) != 1 {
		t.Fatalf("OAuth state cookie is not sent to registered callback: %+v", cookies)
	}
	callback := httptest.NewRequest(http.MethodGet, cfg.MetaRedirectURI+"?code=test-code&state="+url.QueryEscape(state), nil)
	for _, cookie := range cookies {
		callback.AddCookie(cookie)
	}
	result := httptest.NewRecorder()
	handler.ServeHTTP(result, callback)
	if result.Code != http.StatusSeeOther || !strings.Contains(result.Header().Get("Location"), "/setup?step=2") {
		t.Fatalf("callback status %d location %s", result.Code, result.Header().Get("Location"))
	}
	var session string
	for _, c := range result.Result().Cookies() {
		if c.Name == "ids_session" {
			session = c.Value
		}
	}
	if session == "" {
		t.Fatal("no authenticated session")
	}
	principal, err := db.PrincipalBySession(context.Background(), security.TokenHash(session))
	if err != nil || principal.SessionAuth != "instagram:test-instagram-id" {
		t.Fatalf("Instagram session not persisted: %v", err)
	}
	replay := httptest.NewRecorder()
	handler.ServeHTTP(replay, callback)
	if replay.Code != http.StatusSeeOther || !strings.Contains(replay.Header().Get("Location"), "invalid_state") {
		t.Fatal("OAuth state replay accepted")
	}
}
