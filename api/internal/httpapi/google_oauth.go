package httpapi

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"golang.org/x/oauth2"
)

const googleIssuer = "https://accounts.google.com"
const googleJWKSEndpoint = "https://www.googleapis.com/oauth2/v3/certs"

type googleOAuth struct {
	config   oauth2.Config
	verifier *oidc.IDTokenVerifier
}

func newGoogleOAuth(cfg config.Config) *googleOAuth {
	if !cfg.GoogleOAuthReady() {
		return nil
	}
	return &googleOAuth{
		config: oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.GoogleRedirectURL,
			Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
				TokenURL: "https://oauth2.googleapis.com/token",
			},
		},
		verifier: oidc.NewVerifier(googleIssuer, oidc.NewRemoteKeySet(context.Background(), googleJWKSEndpoint), &oidc.Config{
			ClientID:             cfg.GoogleClientID,
			SupportedSigningAlgs: []string{"RS256"},
		}),
	}
}

func (s *Server) googleStatus(w http.ResponseWriter, _ *http.Request) {
	respond(w, http.StatusOK, map[string]bool{"enabled": s.google != nil})
}

func (s *Server) googleStart(w http.ResponseWriter, r *http.Request) {
	if s.google == nil {
		fail(w, http.StatusServiceUnavailable, "google_oauth_unavailable", "Google orqali kirish serverda sozlanmagan")
		return
	}
	if !contains(s.cfg.AllowedOrigins, r.Header.Get("Origin")) {
		fail(w, http.StatusForbidden, "origin_forbidden", "So‘rov manbasi ruxsat etilmagan")
		return
	}
	var input struct {
		Intent      string `json:"intent"`
		AcceptTerms bool   `json:"accept_terms"`
		RememberMe  bool   `json:"remember_me"`
	}
	if decode(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_json", "Ma’lumot formati noto‘g‘ri")
		return
	}
	if input.Intent != "login" && input.Intent != "register" {
		fail(w, http.StatusUnprocessableEntity, "validation_error", "Google kirish turi noto‘g‘ri")
		return
	}
	if input.Intent == "register" && !input.AcceptTerms {
		fail(w, http.StatusUnprocessableEntity, "terms_required", "Davom etishdan oldin foydalanish shartlari va maxfiylik siyosatini qabul qiling")
		return
	}
	stateValue, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	nonce, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	codeVerifier, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	state := store.GoogleLoginState{Nonce: nonce, CodeVerifier: codeVerifier, Intent: input.Intent, AcceptTerms: input.AcceptTerms, RememberMe: input.RememberMe}
	if err = s.store.SaveGoogleLoginState(r.Context(), security.TokenHash(stateValue), state, time.Now().Add(10*time.Minute)); err != nil {
		statusError(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: googleStateCookieName(stateValue), Value: stateValue,
		Path: "/api/v1/auth/google", MaxAge: 600,
		HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
	authorizationURL := s.google.config.AuthCodeURL(stateValue,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("prompt", "select_account"),
		oauth2.SetAuthURLParam("access_type", "online"),
		oauth2.S256ChallengeOption(codeVerifier),
	)
	respond(w, http.StatusOK, map[string]string{"authorization_url": authorizationURL})
}

func (s *Server) googleCallback(w http.ResponseWriter, r *http.Request) {
	stateValue := r.URL.Query().Get("state")
	if stateValue == "" || len(stateValue) > 128 {
		s.redirectGoogleError(w, "login", "invalid_state")
		return
	}
	cookieName := googleStateCookieName(stateValue)
	cookie, err := r.Cookie(cookieName)
	if err != nil || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(stateValue)) != 1 {
		s.clearGoogleStateCookie(w, cookieName)
		s.redirectGoogleError(w, "login", "invalid_state")
		return
	}
	s.clearGoogleStateCookie(w, cookieName)
	state, err := s.store.ConsumeGoogleLoginState(r.Context(), security.TokenHash(stateValue))
	if err != nil {
		s.redirectGoogleError(w, "login", "invalid_state")
		return
	}
	if providerError := r.URL.Query().Get("error"); providerError != "" {
		if providerError == "access_denied" {
			s.redirectGoogleError(w, state.Intent, "cancelled")
		} else {
			s.redirectGoogleError(w, state.Intent, "provider_error")
		}
		return
	}
	if s.google == nil || state.Intent == "register" && !state.AcceptTerms {
		s.redirectGoogleError(w, state.Intent, "google_unavailable")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" || len(code) > 4096 {
		s.redirectGoogleError(w, state.Intent, "provider_error")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	token, err := s.google.config.Exchange(ctx, code, oauth2.VerifierOption(state.CodeVerifier))
	if err != nil {
		s.redirectGoogleError(w, state.Intent, "provider_error")
		return
	}
	idTokenValue, ok := token.Extra("id_token").(string)
	if !ok || idTokenValue == "" {
		s.redirectGoogleError(w, state.Intent, "provider_error")
		return
	}
	idToken, err := s.google.verifier.Verify(ctx, idTokenValue)
	if err != nil {
		s.redirectGoogleError(w, state.Intent, "provider_error")
		return
	}
	var claims struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		Name          string `json:"name"`
		EmailVerified bool   `json:"email_verified"`
		Nonce         string `json:"nonce"`
	}
	if err = idToken.Claims(&claims); err != nil || claims.Subject == "" || !claims.EmailVerified || subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(state.Nonce)) != 1 {
		s.redirectGoogleError(w, state.Intent, "identity_not_verified")
		return
	}
	email, valid := normalizeEmail(claims.Email)
	if !valid {
		s.redirectGoogleError(w, state.Intent, "identity_not_verified")
		return
	}
	password, err := security.RandomToken(48)
	if err != nil {
		statusError(w, err)
		return
	}
	passwordHash, err := security.HashPassword(password)
	if err != nil {
		statusError(w, err)
		return
	}
	principal, err := s.store.CompleteGoogleLogin(r.Context(), claims.Subject, email, claims.Name, passwordHash, state.Intent == "register")
	if err != nil {
		if errors.Is(err, store.ErrGoogleAccountNotFound) {
			s.redirectGoogleError(w, "login", "account_not_found")
			return
		}
		if errors.Is(err, store.ErrGoogleIdentityConflict) {
			s.redirectGoogleError(w, state.Intent, "account_conflict")
			return
		}
		statusError(w, err)
		return
	}
	ttl := s.cfg.ShortSessionTTL
	if state.RememberMe {
		ttl = s.cfg.SessionTTL
	}
	sessionToken, _, expiresAt, err := s.startSession(r, principal, ttl)
	if err != nil {
		statusError(w, err)
		return
	}
	s.setSessionCookie(w, sessionToken, expiresAt, state.RememberMe)
	http.Redirect(w, r, strings.TrimRight(s.cfg.AppURL, "/")+"/app", http.StatusSeeOther)
}

func googleStateCookieName(state string) string {
	if len(state) > 12 {
		state = state[:12]
	}
	return "ids_google_oauth_" + state
}

func (s *Server) clearGoogleStateCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/api/v1/auth/google", MaxAge: -1, HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode})
}

func (s *Server) redirectGoogleError(w http.ResponseWriter, intent, code string) {
	path := "/login"
	if intent == "register" || code == "account_not_found" {
		path = "/register"
	}
	base, err := url.Parse(s.cfg.AppURL)
	if err != nil {
		base = &url.URL{Scheme: "https", Host: "localhost"}
	}
	base.Path = strings.TrimRight(base.Path, "/") + path
	base.RawQuery = "google_error=" + url.QueryEscape(code)
	w.Header().Set("Location", base.String())
	w.WriteHeader(http.StatusSeeOther)
}
