package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
)

func (s *Server) conversations(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	search := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(search) > 100 {
		fail(w, 422, "validation_error", "Qidiruv 100 belgidan oshmasin")
		return
	}
	items, err := s.store.Conversations(r.Context(), p.WorkspaceID, search)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items})
}
func (s *Server) messages(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.Messages(r.Context(), p.WorkspaceID, r.PathValue("id"))
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items})
}
func (s *Server) sendMessage(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	var input struct {
		Text            string `json:"text"`
		ClientRequestID string `json:"client_request_id"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Xabar formati noto‘g‘ri")
		return
	}
	input.Text = strings.TrimSpace(input.Text)
	if input.Text == "" || len(input.Text) > 1000 {
		fail(w, 422, "validation_error", "Xabar 1–1000 belgidan iborat bo‘lsin")
		return
	}
	if !validClientRequestID(input.ClientRequestID) {
		fail(w, 422, "validation_error", "client_request_id noto‘g‘ri")
		return
	}
	conversationID := r.PathValue("id")
	accountID, participantID, canReplyUntil, err := s.store.ConversationForReply(r.Context(), p.WorkspaceID, conversationID)
	if err != nil {
		statusError(w, err)
		return
	}
	if canReplyUntil == nil || time.Now().After(*canReplyUntil) {
		fail(w, 409, "policy_window_closed", "Meta messaging oynasi yopilgan; xabar yuborilmadi")
		return
	}
	providerAccountID, encrypted, accountProvider, _, err := s.store.AccountSecretByID(r.Context(), p.WorkspaceID, accountID)
	if err != nil {
		statusError(w, err)
		return
	}
	if accountProvider != s.provider.Name() {
		fail(w, 409, "provider_mismatch", "Akkaunt faol providerga mos emas")
		return
	}
	token, err := s.cipher.Decrypt(encrypted)
	if err != nil {
		fail(w, 503, "token_unavailable", "Akkauntni qayta ulang")
		return
	}
	messageID, acquired, err := s.store.BeginManualMessage(r.Context(), p.WorkspaceID, conversationID, input.ClientRequestID, input.Text)
	if err != nil {
		statusError(w, err)
		return
	}
	if !acquired {
		respond(w, 200, map[string]any{"message_id": messageID, "status": "already_accepted"})
		return
	}
	delivery, err := s.provider.SendMessage(r.Context(), token, providerAccountID, participantID, input.Text)
	if err != nil {
		if updateErr := s.store.CompleteManualMessage(r.Context(), p.WorkspaceID, conversationID, messageID, "failed", ""); updateErr != nil {
			slog.Error("manual delivery failure state could not be stored", "message_id", messageID, "error", updateErr)
		}
		fail(w, 502, "provider_error", "Provider xabarni qabul qilmadi")
		return
	}
	if err = s.store.CompleteManualMessage(r.Context(), p.WorkspaceID, conversationID, messageID, "sent", delivery.MessageID); err != nil {
		statusError(w, err)
		return
	}
	respond(w, 201, map[string]any{"message_id": delivery.MessageID, "status": "sent"})
}

func validClientRequestID(value string) bool {
	if len(value) < 16 || len(value) > 100 {
		return false
	}
	for _, char := range value {
		if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '-' && char != '_' {
			return false
		}
	}
	return true
}

func (s *Server) analytics(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	days := 30
	if value, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil && value >= 7 && value <= 365 {
		days = value
	}
	to := time.Now()
	from := to.AddDate(0, 0, -days+1)
	metrics, err := s.store.Metrics(r.Context(), p.WorkspaceID, from, to)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"summary": metrics, "range": map[string]any{"from": from, "to": to, "days": days}})
}
func (s *Server) team(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.Members(r.Context(), p.WorkspaceID)
	if err != nil {
		statusError(w, err)
		return
	}
	invitations, err := s.store.Invitations(r.Context(), p.WorkspaceID)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items, "invitations": invitations, "roles": []string{"owner", "manager", "operator", "customer"}})
}
func (s *Server) inviteMember(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	var input struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Taklif formati noto‘g‘ri")
		return
	}
	normalizedEmail, validEmail := normalizeEmail(input.Email)
	if !validEmail {
		fail(w, 422, "validation_error", "Email noto‘g‘ri")
		return
	}
	input.Email = normalizedEmail
	token, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	if err := s.store.CreateInvitation(r.Context(), p, input.Email, input.Role, security.TokenHash(token), time.Now().Add(7*24*time.Hour)); err != nil {
		if errors.Is(err, store.ErrInvalidRole) {
			fail(w, 422, "validation_error", "Rol manager, operator yoki customer bo‘lsin")
			return
		}
		statusError(w, err)
		return
	}
	invitationURL := s.cfg.AppURL + "/app/invitations/accept?token=" + url.QueryEscape(token)
	if err := s.mailer.Send(r.Context(), input.Email, "IDS Automate workspace taklifi", "Workspace’ga qo‘shilish uchun hisobingizga kiring va havolani oching:\n\n"+invitationURL+"\n\nTaklif 7 kun amal qiladi."); err != nil {
		slog.Error("invitation email failed", "workspace_id", p.WorkspaceID, "error", err)
		fail(w, 503, "mail_unavailable", "Taklif yaratildi, ammo xat yuborilmadi. Qayta taklif qilish mumkin.")
		return
	}
	result := map[string]any{"message": "Taklif yaratildi", "expires_in_days": 7}
	if s.cfg.Env != "production" {
		result["dev_invitation_token"] = token
	}
	respond(w, 201, result)
}
func (s *Server) updateMemberRole(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	var input struct {
		Role string `json:"role"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Rol formati noto‘g‘ri")
		return
	}
	if err := s.store.UpdateMemberRole(r.Context(), p, r.PathValue("id"), input.Role); err != nil {
		if errors.Is(err, store.ErrOwnerProtected) {
			fail(w, 409, "owner_protected", "Workspace owner roli o‘zgartirilmaydi")
			return
		}
		if errors.Is(err, store.ErrInvalidRole) {
			fail(w, 422, "validation_error", "Rol manager, operator yoki customer bo‘lsin")
			return
		}
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]string{"message": "A’zo roli yangilandi"})
}
func (s *Server) removeMember(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if err := s.store.RemoveMember(r.Context(), p, r.PathValue("id")); err != nil {
		switch {
		case errors.Is(err, store.ErrOwnerProtected):
			fail(w, 409, "owner_protected", "Workspace owner olib tashlanmaydi")
		case errors.Is(err, store.ErrSelfRemoval):
			fail(w, 409, "self_removal_blocked", "Joriy owner o‘zini olib tashlay olmaydi")
		default:
			statusError(w, err)
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) cancelInvitation(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if err := s.store.CancelInvitation(r.Context(), p, r.PathValue("id")); err != nil {
		statusError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) acceptInvitation(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	var input struct {
		Token string `json:"token"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Taklif formati noto‘g‘ri")
		return
	}
	if err := s.store.AcceptInvitation(r.Context(), p, security.TokenHash(input.Token)); err != nil {
		fail(w, 400, "invalid_invitation", "Taklif eskirgan yoki boshqa emailga tegishli")
		return
	}
	respond(w, 200, map[string]string{"message": "Workspace’ga qo‘shildingiz"})
}
func (s *Server) settings(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	settings, err := s.store.Settings(r.Context(), p)
	if err != nil {
		statusError(w, err)
		return
	}
	settings["instagram_provider"] = s.provider.Name()
	settings["meta_login_mode"] = s.cfg.MetaLoginMode
	settings["meta_configured"] = s.metaConfigured()
	settings["queue_depth"] = s.worker.Depth()
	settings["webhook_url"] = strings.TrimRight(s.cfg.APIURL, "/") + "/api/v1/webhooks/instagram"
	respond(w, 200, settings)
}
func (s *Server) updateSettings(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	var input struct {
		Name                 string `json:"name"`
		WorkspaceName        string `json:"workspace_name"`
		Language             string `json:"language"`
		NotificationsEnabled bool   `json:"notifications_enabled"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Sozlamalar formati noto‘g‘ri")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.WorkspaceName = strings.TrimSpace(input.WorkspaceName)
	if len(input.Name) < 2 || len(input.Name) > 80 || len(input.WorkspaceName) < 2 || len(input.WorkspaceName) > 100 {
		fail(w, 422, "validation_error", "Ism 2–80, workspace nomi 2–100 belgidan iborat bo‘lsin")
		return
	}
	if err := s.store.UpdateSettings(r.Context(), p, input.Name, input.WorkspaceName, input.Language, input.NotificationsEnabled); err != nil {
		fail(w, 422, "validation_error", err.Error())
		return
	}
	respond(w, 200, map[string]string{"message": "Sozlamalar saqlandi"})
}
func (s *Server) auditLogs(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.AuditEntries(r.Context(), p.WorkspaceID, 100)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items})
}
func (s *Server) sessions(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.UserSessions(r.Context(), p.UserID, p.SessionID)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items})
}
func (s *Server) revokeSession(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	sessionID := r.PathValue("id")
	if err := s.store.RevokeSession(r.Context(), p.UserID, sessionID); err != nil {
		statusError(w, err)
		return
	}
	if sessionID == p.SessionID {
		http.SetCookie(w, &http.Cookie{Name: "ids_session", Value: "", Path: "/", HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) dataDeletionRequest(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	var input struct {
		Confirm string `json:"confirm"`
	}
	if decode(r, &input) != nil || input.Confirm != "DELETE" {
		fail(w, 422, "confirmation_required", "Tasdiqlash uchun DELETE yozing")
		return
	}
	_ = s.store.Audit(r.Context(), p.WorkspaceID, p.UserID, "privacy.deletion_requested", "workspace", p.WorkspaceID, map[string]any{"status": "pending_manual_review"})
	respond(w, 202, map[string]string{"status": "pending_manual_review", "message": "So‘rov audit jurnaliga yozildi. Ma’lumotlar avtomatik o‘chirilmadi."})
}
