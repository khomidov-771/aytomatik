package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/mail"
	"net/netip"
	"strings"
	"sync"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/mailer"
	"github.com/ids-automate/ids-automate/api/internal/provider"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/worker"
)

type contextKey string

const principalKey contextKey = "principal"

type Server struct {
	cfg      config.Config
	store    *store.Store
	provider provider.Instagram
	cipher   *security.TokenCipher
	worker   *worker.Worker
	mailer   mailer.Mailer
	limiter  *rateLimiter
	google   *googleOAuth
}

func New(cfg config.Config, s *store.Store, p provider.Instagram, c *security.TokenCipher, w *worker.Worker) *Server {
	return &Server{cfg: cfg, store: s, provider: p, cipher: c, worker: w, mailer: mailer.New(cfg), limiter: newRateLimiter(10, time.Minute), google: newGoogleOAuth(cfg)}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("POST /api/v1/auth/register", s.rateLimit(s.register))
	mux.HandleFunc("POST /api/v1/auth/login", s.rateLimit(s.login))
	mux.HandleFunc("GET /api/v1/auth/instagram/status", s.instagramLoginStatus)
	mux.HandleFunc("POST /api/v1/auth/instagram/start", s.rateLimit(s.instagramLoginStart))
	mux.HandleFunc("GET /api/v1/auth/google/status", s.googleStatus)
	mux.HandleFunc("POST /api/v1/auth/google/start", s.rateLimit(s.googleStart))
	mux.HandleFunc("GET /api/v1/auth/google/callback", s.googleCallback)
	mux.HandleFunc("POST /api/v1/auth/forgot-password", s.rateLimit(s.forgotPassword))
	mux.HandleFunc("POST /api/v1/auth/reset-password", s.rateLimit(s.resetPassword))
	mux.HandleFunc("POST /api/v1/auth/verify-email", s.verifyEmail)
	mux.HandleFunc("POST /api/v1/auth/resend-verification", s.rateLimit(s.resendVerification))
	mux.HandleFunc("POST /api/v1/auth/logout", s.auth(true, "customer", s.logout))
	mux.HandleFunc("GET /api/v1/me", s.auth(false, "customer", s.me))
	mux.HandleFunc("GET /api/v1/workspaces", s.auth(false, "customer", s.workspaces))
	mux.HandleFunc("POST /api/v1/workspaces/{id}/switch", s.auth(true, "customer", s.switchWorkspace))
	mux.HandleFunc("GET /api/v1/instagram/connect", s.auth(false, "manager", s.instagramConnect))
	mux.HandleFunc("GET /api/v1/instagram/callback", s.instagramCallback)
	mux.HandleFunc("GET /api/v1/instagram/accounts", s.auth(false, "customer", s.instagramAccounts))
	mux.HandleFunc("GET /api/v1/instagram/accounts/{id}/media", s.auth(false, "manager", s.instagramMedia))
	mux.HandleFunc("DELETE /api/v1/instagram/accounts/{id}", s.auth(true, "manager", s.instagramDisconnect))
	mux.HandleFunc("GET /api/v1/automations", s.auth(false, "customer", s.automations))
	mux.HandleFunc("POST /api/v1/automations", s.auth(true, "manager", s.createAutomation))
	mux.HandleFunc("POST /api/v1/automations/match-preview", s.auth(true, "manager", s.previewAutomationMatch))
	mux.HandleFunc("GET /api/v1/automations/{id}", s.auth(false, "customer", s.getAutomation))
	mux.HandleFunc("PATCH /api/v1/automations/{id}", s.auth(true, "manager", s.updateAutomation))
	mux.HandleFunc("DELETE /api/v1/automations/{id}", s.auth(true, "manager", s.deleteAutomation))
	mux.HandleFunc("GET /api/v1/automations/{id}/executions", s.auth(false, "customer", s.automationExecutions))
	mux.HandleFunc("GET /api/v1/webhooks/instagram", s.verifyWebhook)
	mux.HandleFunc("POST /api/v1/webhooks/instagram", s.instagramWebhook)
	mux.HandleFunc("GET /api/v1/inbox/conversations", s.auth(false, "operator", s.conversations))
	mux.HandleFunc("GET /api/v1/inbox/conversations/{id}/messages", s.auth(false, "operator", s.messages))
	mux.HandleFunc("POST /api/v1/inbox/conversations/{id}/messages", s.auth(true, "operator", s.sendMessage))
	mux.HandleFunc("GET /api/v1/analytics/summary", s.auth(false, "manager", s.analytics))
	mux.HandleFunc("GET /api/v1/team", s.auth(false, "manager", s.team))
	mux.HandleFunc("POST /api/v1/team/invitations", s.auth(true, "owner", s.inviteMember))
	mux.HandleFunc("DELETE /api/v1/team/invitations/{id}", s.auth(true, "owner", s.cancelInvitation))
	mux.HandleFunc("POST /api/v1/team/invitations/accept", s.auth(true, "customer", s.acceptInvitation))
	mux.HandleFunc("PATCH /api/v1/team/members/{id}", s.auth(true, "owner", s.updateMemberRole))
	mux.HandleFunc("DELETE /api/v1/team/members/{id}", s.auth(true, "owner", s.removeMember))
	mux.HandleFunc("GET /api/v1/settings", s.auth(false, "customer", s.settings))
	mux.HandleFunc("PATCH /api/v1/settings", s.auth(true, "customer", s.updateSettings))
	mux.HandleFunc("GET /api/v1/audit-logs", s.auth(false, "manager", s.auditLogs))
	mux.HandleFunc("GET /api/v1/sessions", s.auth(false, "customer", s.sessions))
	mux.HandleFunc("DELETE /api/v1/sessions/{id}", s.auth(true, "customer", s.revokeSession))
	mux.HandleFunc("POST /api/v1/settings/data-deletion-request", s.auth(true, "owner", s.dataDeletionRequest))
	return s.recover(s.cors(s.securityHeaders(mux)))
}

func (s *Server) auth(csrf bool, minRole string, next func(http.ResponseWriter, *http.Request, domain.Principal)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("ids_session")
		if err != nil || cookie.Value == "" {
			fail(w, http.StatusUnauthorized, "unauthorized", "Kirish talab qilinadi")
			return
		}
		p, err := s.store.PrincipalBySession(r.Context(), security.TokenHash(cookie.Value))
		if err != nil {
			if errors.Is(err, store.ErrEmailUnverified) {
				fail(w, http.StatusForbidden, "email_unverified", "Email manzilingizni tasdiqlang")
				return
			}
			fail(w, http.StatusUnauthorized, "unauthorized", "Sessiya tugagan")
			return
		}
		if !roleAtLeast(p.Role, minRole) {
			fail(w, http.StatusForbidden, "forbidden", "Bu amal uchun ruxsat yetarli emas")
			return
		}
		if csrf && r.Header.Get("X-CSRF-Token") != p.CSRFToken {
			fail(w, http.StatusForbidden, "csrf_failed", "Xavfsizlik tokeni noto‘g‘ri")
			return
		}
		next(w, r, p)
	}
}

func roleAtLeast(actual, required string) bool {
	rank := map[string]int{"customer": 1, "operator": 2, "manager": 3, "owner": 4}
	return rank[actual] >= rank[required]
}
func decode(r *http.Request, dest any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dest); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return errors.New("request body must contain exactly one JSON value")
	}
	return nil
}

func normalizeEmail(value string) (string, bool) {
	value = strings.TrimSpace(value)
	address, err := mail.ParseAddress(value)
	if err != nil || !strings.EqualFold(address.Address, value) || len(value) > 254 {
		return "", false
	}
	return strings.ToLower(address.Address), true
}
func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, code, message string) {
	respond(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
func pctx(r *http.Request) domain.Principal {
	value, _ := r.Context().Value(principalKey).(domain.Principal)
	return value
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if contains(s.cfg.AllowedOrigins, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}
func (s *Server) recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if value := recover(); value != nil {
				slog.Error("request panic", "path", r.URL.Path)
				fail(w, 500, "internal_error", "Server xatosi")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

type rateBucket struct {
	count int
	reset time.Time
}
type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	items  map[string]rateBucket
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, items: map[string]rateBucket{}}
}
func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if len(l.items) > 1000 {
		for itemKey, item := range l.items {
			if now.After(item.reset) {
				delete(l.items, itemKey)
			}
		}
	}
	bucket := l.items[key]
	if now.After(bucket.reset) {
		bucket = rateBucket{reset: now.Add(l.window)}
	}
	bucket.count++
	l.items[key] = bucket
	return bucket.count <= l.limit
}
func (s *Server) rateLimit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host := s.clientIP(r)
		if !s.limiter.allow(host + ":" + r.URL.Path) {
			fail(w, 429, "rate_limited", "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring")
			return
		}
		next(w, r)
	}
}

func (s *Server) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	remote, err := netip.ParseAddr(host)
	if err != nil {
		return host
	}
	trusted := false
	for _, value := range s.cfg.TrustedProxyCIDRs {
		prefix, parseErr := netip.ParsePrefix(value)
		if parseErr == nil && prefix.Contains(remote) {
			trusted = true
			break
		}
	}
	if trusted {
		candidate, parseErr := netip.ParseAddr(strings.TrimSpace(r.Header.Get("X-Real-IP")))
		if parseErr == nil {
			return candidate.String()
		}
	}
	return remote.String()
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.DB.Ping(ctx); err != nil {
		fail(w, 503, "database_unavailable", "Database bilan aloqa yo‘q")
		return
	}
	respond(w, 200, map[string]any{"status": "ok", "provider": s.provider.Name(), "meta_configured": s.metaConfigured(), "queue_depth": s.worker.Depth()})
}

func statusError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		fail(w, 404, "not_found", "Ma’lumot topilmadi")
	default:
		slog.Error("request failed", "error", err)
		fail(w, 500, "internal_error", "Server xatosi")
	}
}
func cleanError(err error) string {
	if err == nil {
		return ""
	}
	value := err.Error()
	if strings.Contains(strings.ToLower(value), "token") {
		return "provider authentication failed"
	}
	return value
}
