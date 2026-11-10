package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
)

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name        string `json:"name"`
		Email       string `json:"email"`
		Password    string `json:"password"`
		AcceptTerms bool   `json:"accept_terms"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Ma’lumot formati noto‘g‘ri")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	if len(input.Name) < 2 || len(input.Name) > 80 {
		fail(w, 422, "validation_error", "Ism 2–80 belgidan iborat bo‘lsin")
		return
	}
	normalizedEmail, validEmail := normalizeEmail(input.Email)
	if !validEmail {
		fail(w, 422, "validation_error", "Email noto‘g‘ri")
		return
	}
	input.Email = normalizedEmail
	if !input.AcceptTerms {
		fail(w, 422, "terms_required", "Shartlar va maxfiylik siyosatini qabul qiling")
		return
	}
	hash, err := security.HashPassword(input.Password)
	if err != nil {
		fail(w, 422, "validation_error", "Parol kamida 8 belgi va 72 baytdan oshmagan bo‘lsin")
		return
	}
	p, userID, err := s.store.Register(r.Context(), input.Name, input.Email, hash)
	if err != nil {
		fail(w, 409, "account_exists", "Bu email bilan hisob mavjud")
		return
	}
	verifyToken, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	created, err := s.store.CreateOneTimeToken(r.Context(), input.Email, "email_verify", security.TokenHash(verifyToken), time.Now().Add(24*time.Hour))
	if err != nil || !created {
		statusError(w, err)
		return
	}
	verifyURL := s.cfg.AppURL + "/verify-email?token=" + url.QueryEscape(verifyToken)
	if err = s.mailer.Send(r.Context(), input.Email, "IDS Automate email tasdiqlash", "Email manzilingizni tasdiqlash uchun havola:\n\n"+verifyURL+"\n\nHavola 24 soat amal qiladi."); err != nil {
		slog.Error("verification email failed", "user_id", userID, "error", err)
		fail(w, 503, "mail_unavailable", "Hisob yaratildi, ammo tasdiqlash xati yuborilmadi. Qayta yuborishni sinang.")
		return
	}
	result := map[string]any{"user": p, "email_verification_required": true}
	if s.cfg.Env != "production" {
		result["dev_verification_token"] = verifyToken
		result["notice"] = "Development mail adapter xatni yubormaydi; tasdiqlash tokeni response ichida berildi"
	}
	respond(w, 201, result)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		RememberMe bool   `json:"remember_me"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Ma’lumot formati noto‘g‘ri")
		return
	}
	id, name, email, hash, workspaceID, workspaceName, role, verified, err := s.store.LoginUser(r.Context(), input.Email)
	if err != nil || !security.CheckPassword(hash, input.Password) {
		fail(w, 401, "invalid_credentials", "Email yoki parol noto‘g‘ri")
		return
	}
	if !verified {
		fail(w, 403, "email_unverified", "Kirishdan oldin email manzilingizni tasdiqlang")
		return
	}
	p := domain.Principal{UserID: id, Name: name, Email: email, WorkspaceID: workspaceID, Workspace: workspaceName, Role: role}
	ttl := s.cfg.ShortSessionTTL
	if input.RememberMe {
		ttl = s.cfg.SessionTTL
	}
	sessionToken, csrf, expiresAt, err := s.startSession(r, p, ttl)
	if err != nil {
		statusError(w, err)
		return
	}
	s.setSessionCookie(w, sessionToken, expiresAt, input.RememberMe)
	p.CSRFToken = csrf
	respond(w, 200, map[string]any{"user": p, "csrf_token": csrf})
}
func (s *Server) startSession(r *http.Request, p domain.Principal, ttl time.Duration) (string, string, time.Time, error) {
	token, err := security.RandomToken(32)
	if err != nil {
		return "", "", time.Time{}, err
	}
	csrf, err := security.RandomToken(24)
	if err != nil {
		return "", "", time.Time{}, err
	}
	expiresAt := time.Now().Add(ttl)
	err = s.store.CreateSession(r.Context(), p, security.TokenHash(token), csrf, expiresAt)
	return token, csrf, expiresAt, err
}
func (s *Server) setSessionCookie(w http.ResponseWriter, token string, expiresAt time.Time, persistent bool) {
	cookie := &http.Cookie{Name: "ids_session", Value: token, Path: "/", HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode}
	if persistent {
		cookie.Expires = expiresAt
		cookie.MaxAge = max(1, int(time.Until(expiresAt).Seconds()))
	}
	http.SetCookie(w, cookie)
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	_ = s.store.DeleteSession(r.Context(), p.SessionID, p.UserID)
	http.SetCookie(w, &http.Cookie{Name: "ids_session", Value: "", Path: "/", HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) me(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	respond(w, 200, map[string]any{"user": p, "csrf_token": p.CSRFToken})
}
func (s *Server) workspaces(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.UserWorkspaces(r.Context(), p.UserID)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items, "active_workspace_id": p.WorkspaceID})
}

func (s *Server) switchWorkspace(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	token, err := security.RandomToken(32)
	if err != nil {
		statusError(w, err)
		return
	}
	csrf, err := security.RandomToken(24)
	if err != nil {
		statusError(w, err)
		return
	}
	expiresAt := p.SessionExpiresAt
	if !expiresAt.After(time.Now()) {
		fail(w, http.StatusUnauthorized, "unauthorized", "Sessiya tugagan")
		return
	}
	next, err := s.store.SwitchWorkspace(r.Context(), p.SessionID, p.UserID, r.PathValue("id"), security.TokenHash(token), csrf, expiresAt)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			fail(w, 403, "workspace_forbidden", "Bu workspace uchun a’zolik topilmadi")
			return
		}
		statusError(w, err)
		return
	}
	persistent := time.Until(expiresAt) > s.cfg.ShortSessionTTL
	s.setSessionCookie(w, token, expiresAt, persistent)
	respond(w, 200, map[string]any{"user": next, "csrf_token": csrf})
}

func (s *Server) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Ma’lumot formati noto‘g‘ri")
		return
	}
	normalizedEmail, validEmail := normalizeEmail(input.Email)
	if !validEmail {
		fail(w, 422, "validation_error", "Email noto‘g‘ri")
		return
	}
	input.Email = normalizedEmail
	token, tokenErr := security.RandomToken(32)
	if tokenErr != nil {
		statusError(w, tokenErr)
		return
	}
	created, tokenErr := s.store.CreateOneTimeToken(r.Context(), input.Email, "password_reset", security.TokenHash(token), time.Now().Add(time.Hour))
	if tokenErr != nil {
		statusError(w, tokenErr)
		return
	}
	if created {
		resetURL := s.cfg.AppURL + "/reset-password?token=" + url.QueryEscape(token)
		if sendErr := s.mailer.Send(r.Context(), input.Email, "IDS Automate parolni tiklash", "Parolni tiklash uchun havola:\n\n"+resetURL+"\n\nHavola 1 soat amal qiladi."); sendErr != nil {
			slog.Error("password reset email failed", "error", sendErr)
		}
	}
	result := map[string]any{"message": "Agar hisob mavjud bo‘lsa, tiklash yo‘riqnomasi yuborildi"}
	if created && s.cfg.Env != "production" {
		result["dev_reset_token"] = token
		result["notice"] = "Development mail adapter"
	}
	respond(w, 200, result)
}

func (s *Server) resendVerification(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Ma’lumot formati noto‘g‘ri")
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
	created, err := s.store.CreateOneTimeToken(r.Context(), input.Email, "email_verify", security.TokenHash(token), time.Now().Add(24*time.Hour))
	if err != nil {
		statusError(w, err)
		return
	}
	if created {
		verifyURL := s.cfg.AppURL + "/verify-email?token=" + url.QueryEscape(token)
		if sendErr := s.mailer.Send(r.Context(), input.Email, "IDS Automate email tasdiqlash", "Email manzilingizni tasdiqlash uchun havola:\n\n"+verifyURL+"\n\nHavola 24 soat amal qiladi."); sendErr != nil {
			slog.Error("verification resend failed", "error", sendErr)
		}
	}
	result := map[string]any{"message": "Agar hisob mavjud bo‘lsa, tasdiqlash yo‘riqnomasi yuborildi"}
	if created && s.cfg.Env != "production" {
		result["dev_verification_token"] = token
	}
	respond(w, 200, result)
}
func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Ma’lumot formati noto‘g‘ri")
		return
	}
	hash, err := security.HashPassword(input.Password)
	if err != nil {
		fail(w, 422, "validation_error", "Parol kamida 8 belgi va 72 baytdan oshmagan bo‘lsin")
		return
	}
	if err = s.store.ResetPassword(r.Context(), security.TokenHash(input.Token), hash); err != nil {
		fail(w, 400, "invalid_token", "Havola eskirgan yoki ishlatilgan")
		return
	}
	respond(w, 200, map[string]string{"message": "Parol yangilandi"})
}
func (s *Server) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Token string `json:"token"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Ma’lumot formati noto‘g‘ri")
		return
	}
	if err := s.store.VerifyEmail(r.Context(), security.TokenHash(input.Token)); err != nil {
		fail(w, 400, "invalid_token", "Tasdiqlash havolasi eskirgan yoki ishlatilgan")
		return
	}
	respond(w, 200, map[string]string{"message": "Email tasdiqlandi"})
}
