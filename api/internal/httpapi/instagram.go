package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/provider"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/worker"
)

func (s *Server) instagramLoginStatus(w http.ResponseWriter, _ *http.Request) {
	respond(w, http.StatusOK, map[string]any{
		"enabled":    s.provider.Name() == "meta" && s.cfg.InstagramLoginOAuthReady(),
		"provider":   s.provider.Name(),
		"login_mode": "instagram",
		"api_ready":  s.cfg.MetaWebhookReady(),
	})
}

func (s *Server) instagramLoginStart(w http.ResponseWriter, r *http.Request) {
	if s.provider.Name() != "meta" || !s.cfg.InstagramLoginOAuthReady() {
		fail(w, http.StatusServiceUnavailable, "instagram_login_unavailable", "Instagram Business Login sozlamalari serverda tayyor emas")
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
	if !input.AcceptTerms {
		fail(w, http.StatusUnprocessableEntity, "terms_required", "Davom etishdan oldin foydalanish shartlari va maxfiylik siyosatini qabul qiling")
		return
	}
	if input.Intent != "login" && input.Intent != "register" {
		fail(w, http.StatusBadRequest, "invalid_auth_intent", "Instagram orqali login yoki ro‘yxatdan o‘tishni tanlang")
		return
	}

	randomState, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	state := "idsi." + input.Intent + "." + randomState
	browserBinding, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	if err = s.store.SaveInstagramLoginState(r.Context(), security.TokenHash(state), security.TokenHash(browserBinding), store.InstagramLoginState{RememberMe: input.RememberMe, AcceptTerms: input.AcceptTerms}, time.Now().Add(10*time.Minute)); err != nil {
		statusError(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: instagramStateCookieName(state), Value: browserBinding,
		Path: "/api/v1/instagram", MaxAge: 600, HttpOnly: true,
		Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
	instagramProvider := provider.InstagramLoginClient(s.provider)
	authorizationURL, err := instagramProvider.AuthorizationURL(state)
	if err != nil {
		s.clearInstagramStateCookie(w, instagramStateCookieName(state))
		fail(w, http.StatusServiceUnavailable, "instagram_login_unavailable", "Meta OAuth manzili tayyorlanmadi")
		return
	}
	respond(w, http.StatusOK, map[string]string{"authorization_url": authorizationURL})
}

func (s *Server) instagramLoginCallback(w http.ResponseWriter, r *http.Request) {
	stateValue := r.URL.Query().Get("state")
	intent, intentValid := instagramLoginIntent(stateValue)
	if len(stateValue) < 16 || len(stateValue) > 128 {
		s.redirectInstagramLoginError(w, "invalid_state")
		return
	}
	if !intentValid {
		s.redirectInstagramLoginError(w, "invalid_state")
		return
	}
	cookieName := instagramStateCookieName(stateValue)
	cookie, err := r.Cookie(cookieName)
	if err != nil || cookie.Value == "" {
		s.clearInstagramStateCookie(w, cookieName)
		s.redirectInstagramLoginError(w, "invalid_state", intent)
		return
	}
	s.clearInstagramStateCookie(w, cookieName)
	state, err := s.store.ConsumeInstagramLoginState(r.Context(), security.TokenHash(stateValue), security.TokenHash(cookie.Value))
	if err != nil || !state.AcceptTerms {
		s.redirectInstagramLoginError(w, "invalid_state", intent)
		return
	}
	if providerError := r.URL.Query().Get("error"); providerError != "" {
		if providerError == "access_denied" {
			s.redirectInstagramLoginError(w, "cancelled", intent)
		} else {
			s.redirectInstagramLoginError(w, "provider_error", intent)
		}
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" || len(code) > 4096 || s.provider.Name() != "meta" || !s.cfg.InstagramLoginOAuthReady() {
		s.redirectInstagramLoginError(w, "oauth_unavailable", intent)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	instagramProvider := provider.InstagramLoginClient(s.provider)
	account, err := instagramProvider.ExchangeCode(ctx, code)
	if err != nil || account.ID == "" || account.AccessToken == "" {
		failureCode := instagramOAuthFailureCode(err, account)
		slog.Warn("Instagram login OAuth exchange failed", "provider", s.provider.Name(), "error_code", provider.ErrorCode(err), "failure_reason", failureCode)
		s.redirectInstagramLoginError(w, failureCode, intent)
		return
	}
	encrypted, err := s.cipher.Encrypt(account.AccessToken)
	if err != nil {
		slog.Error("Instagram login token encryption failed", "provider", s.provider.Name())
		s.redirectInstagramLoginError(w, "account_save_failed", intent)
		return
	}
	passwordHash := ""
	if intent == "register" {
		randomPassword, randomErr := security.RandomToken(48)
		if randomErr != nil {
			statusError(w, randomErr)
			return
		}
		passwordHash, err = security.HashPassword(randomPassword)
		if err != nil {
			statusError(w, err)
			return
		}
	}
	principal, accountID, err := s.store.CompleteInstagramLogin(r.Context(), store.AccountInput{
		InstagramUserID: account.ID, Username: account.Username, AccountType: account.AccountType,
		AvatarURL: account.AvatarURL, TokenCiphertext: encrypted, Provider: s.provider.Name(), LoginMode: account.LoginMode,
		Scopes: account.Scopes, TokenExpiresAt: account.ExpiresAt,
	}, passwordHash, intent, state.TermsAcceptedAt)
	if err != nil {
		code := "account_save_failed"
		if errors.Is(err, store.ErrAccountClaimed) || errors.Is(err, store.ErrInstagramIdentityConflict) {
			code = "account_conflict"
		} else if errors.Is(err, store.ErrInstagramIdentityNotFound) {
			code = "account_not_found"
		} else if errors.Is(err, store.ErrInstagramIdentityExists) {
			code = "account_already_exists"
		}
		slog.Warn("Instagram login account binding failed", "provider", s.provider.Name(), "error_code", code)
		s.redirectInstagramLoginError(w, code, intent)
		return
	}
	ttl := s.cfg.ShortSessionTTL
	if state.RememberMe {
		ttl = s.cfg.SessionTTL
	}
	sessionToken, _, expiresAt, err := s.startSession(r, principal, ttl)
	if err != nil {
		s.redirectInstagramLoginError(w, "account_save_failed", intent)
		return
	}
	s.setSessionCookie(w, sessionToken, expiresAt, state.RememberMe)
	redirect := strings.TrimRight(s.cfg.AppURL, "/") + "/app"
	if intent == "register" {
		redirect = strings.TrimRight(s.cfg.AppURL, "/") + "/setup?step=2&account=" + url.QueryEscape(accountID)
	}
	http.Redirect(w, r, redirect, http.StatusSeeOther)
}

func instagramLoginIntent(state string) (string, bool) {
	switch {
	case strings.HasPrefix(state, "idsi.login."):
		return "login", true
	case strings.HasPrefix(state, "idsi.register."):
		return "register", true
	case strings.HasPrefix(state, "idsi.") && !strings.Contains(strings.TrimPrefix(state, "idsi."), "."):
		// Preserve OAuth attempts that were started before the intent-aware flow.
		return "register", true
	default:
		return "", false
	}
}

func instagramStateCookieName(state string) string {
	if len(state) > 24 {
		state = state[:24]
	}
	return "ids_instagram_oauth_" + state
}

func (s *Server) clearInstagramStateCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/api/v1/instagram", MaxAge: -1, HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode})
}

func (s *Server) redirectInstagramLoginError(w http.ResponseWriter, code string, intent ...string) {
	allowed := map[string]bool{"invalid_state": true, "cancelled": true, "provider_error": true, "oauth_unavailable": true, "oauth_exchange_failed": true, "oauth_token_exchange_failed": true, "instagram_asset_access_failed": true, "instagram_asset_not_shared": true, "instagram_professional_account_required": true, "multiple_instagram_assets": true, "webhook_subscription_failed": true, "account_save_failed": true, "account_conflict": true, "account_not_found": true, "account_already_exists": true}
	if !allowed[code] {
		code = "provider_error"
	}
	base, err := url.Parse(s.cfg.AppURL)
	if err != nil {
		base = &url.URL{Scheme: "https", Host: "localhost"}
	}
	base.Path = strings.TrimRight(base.Path, "/") + "/setup"
	query := base.Query()
	query.Set("instagram_error", code)
	if len(intent) > 0 && (intent[0] == "login" || intent[0] == "register") {
		query.Set("auth_mode", intent[0])
	}
	base.RawQuery = query.Encode()
	w.Header().Set("Location", base.String())
	w.WriteHeader(http.StatusSeeOther)
}

func instagramOAuthFailureCode(err error, account provider.Account) string {
	if err != nil {
		return provider.InstagramOAuthFailureCode(err)
	}
	if account.AccessToken == "" {
		return "oauth_token_exchange_failed"
	}
	if account.ID == "" {
		return "instagram_asset_access_failed"
	}
	return "oauth_exchange_failed"
}

func (s *Server) instagramConnect(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if s.provider.Name() != "meta" || !s.cfg.InstagramLoginOAuthReady() {
		fail(w, http.StatusServiceUnavailable, "provider_not_configured", "Instagram Business Login sozlamalari serverda tayyor emas")
		return
	}
	state, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	if err = s.store.SaveOAuthState(r.Context(), p, security.TokenHash(state), time.Now().Add(10*time.Minute)); err != nil {
		statusError(w, err)
		return
	}
	instagramProvider := provider.InstagramLoginClient(s.provider)
	authURL, err := instagramProvider.AuthorizationURL(state)
	if err != nil {
		fail(w, 503, "provider_not_configured", cleanError(err))
		return
	}
	respond(w, 200, map[string]any{"authorization_url": authURL, "provider": s.provider.Name(), "login_mode": "instagram"})
}
func (s *Server) instagramCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if strings.HasPrefix(state, "idsi.") {
		s.instagramLoginCallback(w, r)
		return
	}
	code := r.URL.Query().Get("code")
	errorCode := r.URL.Query().Get("error")
	redirect := s.cfg.AppURL + "/app/accounts"
	if errorCode != "" {
		http.Redirect(w, r, redirect+"?error="+url.QueryEscape(errorCode), http.StatusFound)
		return
	}
	workspaceID, userID, err := s.store.ConsumeOAuthState(r.Context(), security.TokenHash(state))
	if err != nil {
		http.Redirect(w, r, redirect+"?error=invalid_state", http.StatusFound)
		return
	}
	instagramProvider := provider.InstagramLoginClient(s.provider)
	account, err := instagramProvider.ExchangeCode(r.Context(), code)
	if err != nil || account.ID == "" || account.AccessToken == "" {
		failureCode := instagramOAuthFailureCode(err, account)
		slog.Warn("Instagram OAuth exchange failed", "provider", s.provider.Name(), "error_code", provider.ErrorCode(err), "failure_reason", failureCode)
		http.Redirect(w, r, redirect+"?error="+url.QueryEscape(failureCode), http.StatusFound)
		return
	}
	encrypted, err := s.cipher.Encrypt(account.AccessToken)
	if err != nil {
		http.Redirect(w, r, redirect+"?error=token_storage_failed", http.StatusFound)
		return
	}
	err = s.store.UpsertInstagramAccount(r.Context(), workspaceID, userID, store.AccountInput{InstagramUserID: account.ID, Username: account.Username, AccountType: account.AccountType, AvatarURL: account.AvatarURL, TokenCiphertext: encrypted, Provider: s.provider.Name(), LoginMode: account.LoginMode, Scopes: account.Scopes, TokenExpiresAt: account.ExpiresAt})
	if err != nil {
		code := "account_save_failed"
		if errors.Is(err, store.ErrAccountClaimed) {
			code = "account_already_connected"
		}
		http.Redirect(w, r, redirect+"?error="+code, http.StatusFound)
		return
	}
	http.Redirect(w, r, redirect+"?connected=1", http.StatusFound)
}
func (s *Server) instagramAccounts(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.ListInstagramAccounts(r.Context(), p.WorkspaceID)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items, "provider": s.provider.Name(), "login_mode": "instagram", "meta_configured": s.metaConfigured()})
}

func (s *Server) metaConfigured() bool {
	return s.provider.Name() == "meta" && s.cfg.InstagramLoginOAuthReady() && s.cfg.MetaWebhookReady()
}

func (s *Server) instagramMedia(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	providerAccountID, encrypted, accountProvider, loginMode, _, err := s.store.AccountSecretByID(r.Context(), p.WorkspaceID, r.PathValue("id"))
	if err != nil {
		statusError(w, err)
		return
	}
	if accountProvider != s.provider.Name() {
		fail(w, http.StatusConflict, "provider_mismatch", "Instagram akkauntini qayta ulang")
		return
	}
	token, err := s.cipher.Decrypt(encrypted)
	if err != nil {
		slog.Error("instagram media token decrypt failed", "workspace_id", p.WorkspaceID, "account_id", r.PathValue("id"))
		fail(w, http.StatusInternalServerError, "token_unavailable", "Instagram akkauntini qayta ulang")
		return
	}
	instagramProvider := provider.ForLoginMode(s.provider, loginMode)
	items, err := instagramProvider.ListMedia(r.Context(), token, providerAccountID)
	if err != nil {
		slog.Warn("instagram media sync failed", "workspace_id", p.WorkspaceID, "account_id", r.PathValue("id"), "error_code", provider.ErrorCode(err))
		fail(w, http.StatusBadGateway, "media_sync_failed", "Instagram postlari yuklanmadi. Akkauntni qayta ulang yoki Meta ruxsatlarini tekshiring")
		return
	}
	respond(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) instagramDisconnect(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	accountID := r.PathValue("id")
	providerAccountID, encrypted, accountProvider, loginMode, _, secretErr := s.store.AccountSecretByID(r.Context(), p.WorkspaceID, accountID)
	if secretErr != nil {
		statusError(w, secretErr)
		return
	}
	if accountProvider == s.provider.Name() {
		if token, decryptErr := s.cipher.Decrypt(encrypted); decryptErr == nil {
			instagramProvider := provider.ForLoginMode(s.provider, loginMode)
			if disconnectErr := instagramProvider.DisconnectAccount(r.Context(), token, providerAccountID); disconnectErr != nil {
				slog.Warn("provider cleanup failed during local account disconnect", "workspace_id", p.WorkspaceID, "account_id", accountID, "error", disconnectErr)
			}
		}
	}
	if err := s.store.DisconnectInstagramAccount(r.Context(), p.WorkspaceID, p.UserID, accountID); err != nil {
		statusError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) verifyWebhook(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if q.Get("hub.mode") != "subscribe" || q.Get("hub.verify_token") == "" || q.Get("hub.verify_token") != s.cfg.WebhookVerifyToken {
		fail(w, 403, "verification_failed", "Webhook verification failed")
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	_, _ = w.Write([]byte(q.Get("hub.challenge")))
}
func (s *Server) instagramWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		fail(w, 400, "invalid_body", "Webhook body o‘qilmadi")
		return
	}
	if !s.provider.VerifyWebhook(body, r.Header.Get("X-Hub-Signature-256")) {
		fail(w, 401, "invalid_signature", "Webhook imzosi noto‘g‘ri")
		return
	}
	events, err := s.provider.ParseWebhook(body)
	if err != nil {
		fail(w, 400, "invalid_event", "Webhook formati noto‘g‘ri")
		return
	}
	accepted := 0
	persistenceFailed := false
	for _, providerEvent := range events {
		switch providerEvent.Type {
		case domain.ProviderEventComment:
			if providerEvent.Comment == nil {
				continue
			}
			event := *providerEvent.Comment
			eventID, workspaceID, accountID, inserted, saveErr := s.store.EnqueueEvent(r.Context(), s.provider.Name(), event)
			if saveErr != nil {
				persistenceFailed = true
				continue
			}
			if inserted && s.worker.Enqueue(worker.Job{EventID: eventID, WorkspaceID: workspaceID, AccountID: accountID, Event: event}) {
				accepted++
			}
		case domain.ProviderEventInboundMessage:
			if providerEvent.Message == nil {
				continue
			}
			_, _, inserted, saveErr := s.store.RecordInboundMessage(r.Context(), s.provider.Name(), *providerEvent.Message)
			if saveErr != nil {
				persistenceFailed = true
				continue
			}
			if inserted {
				accepted++
			}
		}
	}
	if persistenceFailed {
		fail(w, http.StatusServiceUnavailable, "webhook_persistence_failed", "Webhook vaqtincha saqlanmadi; provider qayta urinishi kerak")
		return
	}
	respond(w, http.StatusAccepted, map[string]int{"accepted": accepted})
}
