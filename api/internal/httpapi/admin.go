package httpapi

import (
	"net/http"
	"regexp"
	"strconv"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

var adminUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func (s *Server) adminOverview(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if !p.IsSuperAdmin {
		fail(w, 403, "forbidden", "Ruxsat yo‘q")
		return
	}
	kind := r.URL.Query().Get("kind")
	offset, err := strconv.Atoi(r.URL.Query().Get("offset"))
	if err != nil || offset < 0 || offset > 1000000 || (kind != "accounts" && kind != "rules" && kind != "conversations" && kind != "keys") {
		fail(w, 400, "invalid_request", "So‘rov noto‘g‘ri")
		return
	}
	if kind == "keys" {
		if err := s.store.Audit(r.Context(), p.WorkspaceID, p.UserID, "super_admin.keys.view", "admin", "keys", nil); err != nil {
			statusError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		respond(w, 200, map[string]any{"items": []map[string]any{
			{"name": "Meta App ID", "configured": s.cfg.MetaAppID != ""},
			{"name": "Meta App Secret", "configured": s.cfg.MetaAppSecret != ""},
			{"name": "Instagram Login App ID", "configured": s.cfg.InstagramLoginAppID != ""},
			{"name": "Instagram Login App Secret", "configured": s.cfg.InstagramLoginAppSecret != ""},
			{"name": "Webhook Verify Token", "configured": s.cfg.WebhookVerifyToken != ""},
			{"name": "Webhook App Secret", "configured": s.cfg.WebhookAppSecret != ""},
			{"name": "Token Encryption Key", "configured": len(s.cfg.EncryptionKey) == 32},
		}, "offset": 0})
		return
	}
	items, err := s.store.AdminRows(r.Context(), kind, offset)
	if err != nil {
		statusError(w, err)
		return
	}
	if err = s.store.Audit(r.Context(), p.WorkspaceID, p.UserID, "super_admin.view", "admin", kind, nil); err != nil {
		statusError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	respond(w, 200, map[string]any{"items": items, "offset": offset})
}

func (s *Server) adminMessages(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if !p.IsSuperAdmin {
		fail(w, 403, "forbidden", "Ruxsat yo‘q")
		return
	}
	id := r.PathValue("id")
	if !adminUUID.MatchString(id) {
		fail(w, 400, "invalid_id", "Suhbat ID noto‘g‘ri")
		return
	}
	offset, err := strconv.Atoi(r.URL.Query().Get("offset"))
	if err != nil || offset < 0 || offset > 1000000 {
		fail(w, 400, "invalid_request", "So‘rov noto‘g‘ri")
		return
	}
	items, err := s.store.AdminMessages(r.Context(), id, offset)
	if err != nil {
		statusError(w, err)
		return
	}
	if err = s.store.Audit(r.Context(), p.WorkspaceID, p.UserID, "super_admin.messages.view", "conversation", id, nil); err != nil {
		statusError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	respond(w, 200, map[string]any{"items": items})
}
