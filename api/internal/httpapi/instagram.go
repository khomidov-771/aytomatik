package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/worker"
)

func (s *Server) instagramConnect(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	state, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	if err = s.store.SaveOAuthState(r.Context(), p, security.TokenHash(state), time.Now().Add(10*time.Minute)); err != nil {
		statusError(w, err)
		return
	}
	authURL, err := s.provider.AuthorizationURL(state)
	if err != nil {
		fail(w, 503, "provider_not_configured", cleanError(err))
		return
	}
	respond(w, 200, map[string]any{"authorization_url": authURL, "provider": s.provider.Name(), "login_mode": s.cfg.MetaLoginMode, "demo_mode": s.provider.IsDemo()})
}
func (s *Server) instagramCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
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
	account, err := s.provider.ExchangeCode(r.Context(), code)
	if err != nil {
		http.Redirect(w, r, redirect+"?error=oauth_exchange_failed", http.StatusFound)
		return
	}
	if s.provider.IsDemo() {
		// Mock identities must be unique per workspace so demo tenants can be
		// exercised without weakening production webhook routing guarantees.
		account.ID = "mock-" + workspaceID
		account.Username = "ids.demo." + workspaceID[:8]
	}
	encrypted, err := s.cipher.Encrypt(account.AccessToken)
	if err != nil {
		http.Redirect(w, r, redirect+"?error=token_storage_failed", http.StatusFound)
		return
	}
	err = s.store.UpsertInstagramAccount(r.Context(), workspaceID, userID, store.AccountInput{InstagramUserID: account.ID, Username: account.Username, AccountType: account.AccountType, AvatarURL: account.AvatarURL, TokenCiphertext: encrypted, Provider: s.provider.Name(), Scopes: account.Scopes, TokenExpiresAt: account.ExpiresAt})
	if err != nil {
		code := "account_save_failed"
		if errors.Is(err, store.ErrLimit) {
			code = "plan_limit"
		} else if errors.Is(err, store.ErrAccountClaimed) {
			code = "account_already_connected"
		}
		http.Redirect(w, r, redirect+"?error="+code, http.StatusFound)
		return
	}
	suffix := "?connected=1"
	if s.provider.IsDemo() {
		suffix += "&demo=1"
	}
	http.Redirect(w, r, redirect+suffix, http.StatusFound)
}
func (s *Server) instagramAccounts(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.ListInstagramAccounts(r.Context(), p.WorkspaceID)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items, "provider": s.provider.Name(), "login_mode": s.cfg.MetaLoginMode, "demo_mode": s.provider.IsDemo()})
}
func (s *Server) instagramDisconnect(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	accountID := r.PathValue("id")
	providerAccountID, encrypted, accountProvider, secretErr := s.store.AccountSecretByID(r.Context(), p.WorkspaceID, accountID)
	if secretErr != nil {
		statusError(w, secretErr)
		return
	}
	if accountProvider == s.provider.Name() {
		if token, decryptErr := s.cipher.Decrypt(encrypted); decryptErr == nil {
			if disconnectErr := s.provider.DisconnectAccount(r.Context(), token, providerAccountID); disconnectErr != nil {
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
			_, _, inserted, saveErr := s.store.RecordInboundMessage(r.Context(), s.provider.Name(), *providerEvent.Message, s.provider.IsDemo())
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
func (s *Server) mockEvent(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if !s.provider.IsDemo() {
		fail(w, 404, "not_found", "Mock endpoint production providerida mavjud emas")
		return
	}
	var event domain.CommentEvent
	if decode(r, &event) != nil {
		fail(w, 400, "invalid_json", "Event formati noto‘g‘ri")
		return
	}
	if event.AccountID == "" || event.CommentID == "" || strings.TrimSpace(event.Text) == "" {
		fail(w, 422, "validation_error", "account_id, comment_id va text talab qilinadi")
		return
	}
	if event.ProviderEventID == "" {
		event.ProviderEventID = "mock:" + event.CommentID
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}
	_, ownerWorkspaceID, _, lookupErr := s.store.AccountSecretByProviderID(r.Context(), s.provider.Name(), event.AccountID)
	if lookupErr != nil {
		statusError(w, lookupErr)
		return
	}
	if ownerWorkspaceID != p.WorkspaceID {
		fail(w, 403, "tenant_mismatch", "Akkaunt boshqa workspacega tegishli")
		return
	}
	eventID, workspaceID, accountID, inserted, err := s.store.EnqueueEvent(r.Context(), s.provider.Name(), event)
	if err != nil {
		statusError(w, err)
		return
	}
	if workspaceID != p.WorkspaceID {
		fail(w, 403, "tenant_mismatch", "Akkaunt boshqa workspacega tegishli")
		return
	}
	if !inserted {
		respond(w, 200, map[string]any{"status": "duplicate", "demo_mode": true})
		return
	}
	queued := s.worker.Enqueue(worker.Job{EventID: eventID, WorkspaceID: workspaceID, AccountID: accountID, Event: event})
	if !queued {
		fail(w, 503, "queue_full", "Queue band, qayta urinib ko‘ring")
		return
	}
	respond(w, 202, map[string]any{"status": "queued", "event_id": eventID, "demo_mode": true})
}

func (s *Server) mockMessage(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if !s.provider.IsDemo() {
		fail(w, 404, "not_found", "Mock endpoint production providerida mavjud emas")
		return
	}
	var event domain.InboundMessageEvent
	if decode(r, &event) != nil {
		fail(w, 400, "invalid_json", "Event formati noto‘g‘ri")
		return
	}
	if event.AccountID == "" || event.ProviderMessageID == "" || event.ParticipantID == "" || strings.TrimSpace(event.Text) == "" {
		fail(w, 422, "validation_error", "account_id, provider_message_id, participant_id va text talab qilinadi")
		return
	}
	if event.ProviderEventID == "" {
		event.ProviderEventID = "message:" + event.ProviderMessageID
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}
	_, ownerWorkspaceID, _, lookupErr := s.store.AccountSecretByProviderID(r.Context(), s.provider.Name(), event.AccountID)
	if lookupErr != nil {
		statusError(w, lookupErr)
		return
	}
	if ownerWorkspaceID != p.WorkspaceID {
		fail(w, 403, "tenant_mismatch", "Akkaunt boshqa workspacega tegishli")
		return
	}
	workspaceID, _, inserted, err := s.store.RecordInboundMessage(r.Context(), s.provider.Name(), event, true)
	if err != nil {
		statusError(w, err)
		return
	}
	if workspaceID != p.WorkspaceID {
		fail(w, 403, "tenant_mismatch", "Akkaunt boshqa workspacega tegishli")
		return
	}
	status := "duplicate"
	if inserted {
		status = "received"
	}
	respond(w, 202, map[string]any{"status": status, "demo_mode": true, "reply_window_hours": 24})
}

func redactJSON(raw []byte) json.RawMessage { return json.RawMessage(`{"redacted":true}`) }
