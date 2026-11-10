//go:build integration

package httpapi

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/fergusstrange/embedded-postgres/v2"
	"github.com/fergusstrange/embedded-postgres/v2/eptest"
	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/mailer"
	"github.com/ids-automate/ids-automate/api/internal/migrations"
	"github.com/ids-automate/ids-automate/api/internal/provider"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/worker"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

func TestGoogleOAuthCallbackControlledProvider(t *testing.T) {
	ctx := context.Background()
	cacheDir := t.TempDir()
	pgConfig := embeddedpostgres.DefaultConfig().Port(0).Database("ids_google_test").StartTimeout(10 * time.Minute).Storage(embeddedpostgres.Storage{
		CacheDir: cacheDir,
		WorkDir:  t.TempDir(),
	}).Provider(embeddedpostgres.DownloadProvider{CacheDir: cacheDir, Client: &http.Client{Timeout: 10 * time.Minute}})
	dsn := eptest.Start(t, pgConfig).ConnectionURL()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err = migrations.Up(ctx, db); err != nil {
		t.Fatal(err)
	}
	applicationStore := &store.Store{DB: db}

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	var idToken string
	var receivedCodeVerifier string
	googleTestServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/keys":
			w.Header().Set("Cache-Control", "public, max-age=3600")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
				"kty": "RSA", "kid": "ids-test", "use": "sig", "alg": "RS256",
				"n": base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
				"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.PublicKey.E)).Bytes()),
			}}})
		case "/token":
			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if err := r.ParseForm(); err != nil {
				http.Error(w, "bad form", http.StatusBadRequest)
				return
			}
			receivedCodeVerifier = r.Form.Get("code_verifier")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "controlled-test-token", "token_type": "Bearer", "expires_in": 3600, "id_token": idToken})
		default:
			http.NotFound(w, r)
		}
	}))
	defer googleTestServer.Close()

	cfg := config.Config{
		Env: "test", AppURL: "https://app.example.test", CookieSecure: true,
		AllowedOrigins:  []string{"https://app.example.test"},
		ShortSessionTTL: time.Hour, SessionTTL: 30 * 24 * time.Hour,
	}
	server := &Server{
		cfg: cfg, store: applicationStore, provider: provider.New(cfg),
		limiter: newRateLimiter(20, time.Minute), mailer: mailer.New(cfg), worker: &worker.Worker{},
		google: &googleOAuth{
			config: oauth2.Config{
				ClientID: "ids-test-client", ClientSecret: "ids-test-secret",
				RedirectURL: "https://api.example.test/api/v1/auth/google/callback",
				Scopes:      []string{oidc.ScopeOpenID, "email", "profile"},
				Endpoint:    oauth2.Endpoint{AuthURL: googleTestServer.URL + "/authorize", TokenURL: googleTestServer.URL + "/token"},
			},
			verifier: oidc.NewVerifier(googleIssuer, oidc.NewRemoteKeySet(ctx, googleTestServer.URL+"/keys"), &oidc.Config{ClientID: "ids-test-client", SupportedSigningAlgs: []string{"RS256"}}),
		},
	}

	startFlow := func(intent string) (string, string, *http.Cookie) {
		t.Helper()
		request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/start", strings.NewReader(`{"intent":"`+intent+`","accept_terms":true,"remember_me":true}`))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Origin", "https://app.example.test")
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("Google start returned %d: %s", response.Code, response.Body.String())
		}
		var result struct {
			AuthorizationURL string `json:"authorization_url"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		authorization, err := url.Parse(result.AuthorizationURL)
		if err != nil {
			t.Fatal(err)
		}
		state, nonce := authorization.Query().Get("state"), authorization.Query().Get("nonce")
		if authorization.Query().Get("client_id") != "ids-test-client" || authorization.Query().Get("redirect_uri") != server.google.config.RedirectURL || !strings.Contains(authorization.Query().Get("scope"), "openid") || state == "" || nonce == "" || authorization.Query().Get("code_challenge_method") != "S256" {
			t.Fatalf("authorization URL missing OIDC protections: %s", result.AuthorizationURL)
		}
		var codeVerifier string
		if err := applicationStore.DB.QueryRow(ctx, `SELECT code_verifier FROM google_oauth_login_states WHERE state_hash=$1`, security.TokenHash(state)).Scan(&codeVerifier); err != nil {
			t.Fatal(err)
		}
		challengeSum := sha256.Sum256([]byte(codeVerifier))
		if authorization.Query().Get("code_challenge") != base64.RawURLEncoding.EncodeToString(challengeSum[:]) {
			t.Fatal("authorization code challenge did not match the database-bound verifier")
		}
		var stateCookie *http.Cookie
		for _, candidate := range response.Result().Cookies() {
			if candidate.Name == googleStateCookieName(state) {
				stateCookie = candidate
			}
		}
		if stateCookie == nil || !stateCookie.HttpOnly || !stateCookie.Secure || stateCookie.SameSite != http.SameSiteLaxMode {
			t.Fatalf("browser-bound OAuth state cookie missing its protections: %#v", stateCookie)
		}
		return state, nonce, stateCookie
	}

	issueToken := func(subject, email, nonce string) {
		t.Helper()
		now := time.Now()
		header, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "ids-test", "typ": "JWT"})
		claims, _ := json.Marshal(map[string]any{
			"iss": googleIssuer, "aud": "ids-test-client", "sub": subject,
			"email": email, "email_verified": true, "name": "Test Google User", "nonce": nonce,
			"iat": now.Unix(), "exp": now.Add(5 * time.Minute).Unix(),
		})
		message := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(claims)
		digest := sha256.Sum256([]byte(message))
		signature, signErr := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
		if signErr != nil {
			t.Fatal(signErr)
		}
		idToken = message + "." + base64.RawURLEncoding.EncodeToString(signature)
	}

	state, nonce, stateCookie := startFlow("register")
	issueToken("google-user-1", "first.user@example.test", nonce)
	callback := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/callback?code=controlled-code&state="+url.QueryEscape(state), nil)
	callback.AddCookie(stateCookie)
	callbackResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(callbackResponse, callback)
	if callbackResponse.Code != http.StatusSeeOther || callbackResponse.Header().Get("Location") != "https://app.example.test/app" {
		t.Fatalf("verified Google registration did not start a session: status=%d location=%q body=%s", callbackResponse.Code, callbackResponse.Header().Get("Location"), callbackResponse.Body.String())
	}
	var sessionCookie *http.Cookie
	for _, candidate := range callbackResponse.Result().Cookies() {
		if candidate.Name == "ids_session" {
			sessionCookie = candidate
		}
	}
	if sessionCookie == nil || !sessionCookie.HttpOnly || !sessionCookie.Secure || sessionCookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie missing its protections: %#v", sessionCookie)
	}
	principal, err := applicationStore.PrincipalBySession(ctx, security.TokenHash(sessionCookie.Value))
	if err != nil || principal.Email != "first.user@example.test" || principal.Role != "owner" || principal.WorkspaceID == "" {
		t.Fatalf("OAuth callback did not persist the user, workspace, and session: %#v %v", principal, err)
	}
	var codeVerifier string
	if err = applicationStore.DB.QueryRow(ctx, `SELECT code_verifier FROM google_oauth_login_states WHERE state_hash=$1`, security.TokenHash(state)).Scan(&codeVerifier); err != nil || receivedCodeVerifier != codeVerifier {
		t.Fatalf("code verifier was not sent during OAuth exchange: present=%v err=%v", receivedCodeVerifier != "", err)
	}

	replay := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/callback?code=controlled-code&state="+url.QueryEscape(state), nil)
	replay.AddCookie(stateCookie)
	replayResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(replayResponse, replay)
	if replayResponse.Code != http.StatusSeeOther || !strings.Contains(replayResponse.Header().Get("Location"), "google_error=invalid_state") {
		t.Fatalf("OAuth callback state was reusable: %d %q", replayResponse.Code, replayResponse.Header().Get("Location"))
	}

	badState, nonce, badCookie := startFlow("register")
	issueToken("google-user-2", "second.user@example.test", "incorrect-nonce")
	badCallback := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/callback?code=controlled-code&state="+url.QueryEscape(badState), nil)
	badCallback.AddCookie(badCookie)
	badResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(badResponse, badCallback)
	if nonce == "" || badResponse.Code != http.StatusSeeOther || !strings.Contains(badResponse.Header().Get("Location"), "google_error=identity_not_verified") {
		t.Fatalf("OIDC nonce mismatch was not rejected: %d %q", badResponse.Code, badResponse.Header().Get("Location"))
	}
	if _, _, _, _, _, _, _, _, lookupErr := applicationStore.LoginUser(ctx, "second.user@example.test"); lookupErr == nil {
		t.Fatal("invalid OIDC nonce created an account")
	}
}
