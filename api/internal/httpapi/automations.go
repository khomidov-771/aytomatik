package httpapi

import (
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/rules"
)

func (s *Server) automations(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	items, err := s.store.ListRules(r.Context(), p.WorkspaceID)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items})
}
func (s *Server) createAutomation(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	var rule domain.AutomationRule
	if decode(r, &rule) != nil {
		fail(w, 400, "invalid_json", "Qoida formati noto‘g‘ri")
		return
	}
	rule.TriggerType = "comment_created"
	rule.Name = strings.TrimSpace(rule.Name)
	rule.PrivateReplyText = strings.TrimSpace(rule.PrivateReplyText)
	rule.PublicSuccessReplyText = strings.TrimSpace(rule.PublicSuccessReplyText)
	rule.PublicNotFollowerReplyText = strings.TrimSpace(rule.PublicNotFollowerReplyText)
	rule.PublicUnknownReplyText = strings.TrimSpace(rule.PublicUnknownReplyText)
	if rule.MediaScope == "" {
		rule.MediaScope = "all"
	}
	if rule.Priority == 0 {
		rule.Priority = 100
	}
	created, err := s.store.CreateRule(r.Context(), p, rule)
	if err != nil {
		if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "too long") {
			fail(w, 422, "validation_error", err.Error())
			return
		}
		statusError(w, err)
		return
	}
	respond(w, 201, created)
}
func (s *Server) getAutomation(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	rule, err := s.store.GetRule(r.Context(), p.WorkspaceID, r.PathValue("id"))
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, rule)
}
func (s *Server) updateAutomation(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	existing, err := s.store.GetRule(r.Context(), p.WorkspaceID, r.PathValue("id"))
	if err != nil {
		statusError(w, err)
		return
	}
	var input struct {
		Name                       *string   `json:"name"`
		MatchMode                  *string   `json:"match_mode"`
		Keywords                   *[]string `json:"keywords"`
		Exclusions                 *[]string `json:"exclusions"`
		MediaScope                 *string   `json:"media_scope"`
		MediaIDs                   *[]string `json:"media_ids"`
		PrivateReplyText           *string   `json:"private_reply_text"`
		PublicSuccessReplyText     *string   `json:"public_success_reply_text"`
		PublicNotFollowerReplyText *string   `json:"public_not_follower_reply_text"`
		PublicUnknownReplyText     *string   `json:"public_unknown_reply_text"`
		FollowVerificationEnabled  *bool     `json:"follow_verification_enabled"`
		UnknownFallbackPolicy      *string   `json:"unknown_fallback_policy"`
		IsActive                   *bool     `json:"is_active"`
		Priority                   *int      `json:"priority"`
	}
	if decode(r, &input) != nil {
		fail(w, 400, "invalid_json", "Qoida formati noto‘g‘ri")
		return
	}
	if input.Name != nil {
		existing.Name = *input.Name
	}
	if input.MatchMode != nil {
		existing.MatchMode = *input.MatchMode
	}
	if input.Keywords != nil {
		existing.Keywords = *input.Keywords
	}
	if input.Exclusions != nil {
		existing.Exclusions = *input.Exclusions
	}
	if input.MediaScope != nil {
		existing.MediaScope = *input.MediaScope
	}
	if input.MediaIDs != nil {
		existing.MediaIDs = *input.MediaIDs
	}
	if input.PrivateReplyText != nil {
		existing.PrivateReplyText = *input.PrivateReplyText
	}
	if input.PublicSuccessReplyText != nil {
		existing.PublicSuccessReplyText = *input.PublicSuccessReplyText
	}
	if input.PublicNotFollowerReplyText != nil {
		existing.PublicNotFollowerReplyText = *input.PublicNotFollowerReplyText
	}
	if input.PublicUnknownReplyText != nil {
		existing.PublicUnknownReplyText = *input.PublicUnknownReplyText
	}
	if input.FollowVerificationEnabled != nil {
		existing.FollowVerificationEnabled = *input.FollowVerificationEnabled
	}
	if input.UnknownFallbackPolicy != nil {
		existing.UnknownFallbackPolicy = *input.UnknownFallbackPolicy
	}
	if input.IsActive != nil {
		existing.IsActive = *input.IsActive
	}
	if input.Priority != nil {
		existing.Priority = *input.Priority
	}
	updated, err := s.store.UpdateRule(r.Context(), p, existing)
	if err != nil {
		if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "too long") {
			fail(w, 422, "validation_error", err.Error())
			return
		}
		statusError(w, err)
		return
	}
	respond(w, 200, updated)
}

func (s *Server) automationExecutions(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if _, err := s.store.GetRule(r.Context(), p.WorkspaceID, r.PathValue("id")); err != nil {
		statusError(w, err)
		return
	}
	items, err := s.store.ExecutionHistory(r.Context(), p.WorkspaceID, r.PathValue("id"), 50)
	if err != nil {
		statusError(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items})
}
func (s *Server) deleteAutomation(w http.ResponseWriter, r *http.Request, p domain.Principal) {
	if err := s.store.DeleteRule(r.Context(), p, r.PathValue("id")); err != nil {
		statusError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) previewAutomationMatch(w http.ResponseWriter, r *http.Request, _ domain.Principal) {
	var input struct {
		Name       string   `json:"name"`
		Text       string   `json:"text"`
		MatchMode  string   `json:"match_mode"`
		Keywords   []string `json:"keywords"`
		Exclusions []string `json:"exclusions"`
	}
	if decode(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_json", "Sinov matni formati noto‘g‘ri")
		return
	}
	if input.MatchMode != "keyword_list" && input.MatchMode != "contains" && input.MatchMode != "exact" {
		fail(w, http.StatusUnprocessableEntity, "validation_error", "Moslik turi noto‘g‘ri")
		return
	}
	if utf8.RuneCountInString(input.Text) > 1000 || len(input.Keywords) == 0 || len(input.Keywords) > 20 {
		fail(w, http.StatusUnprocessableEntity, "validation_error", "Comment 1000 belgidan, kalit so‘zlar esa 20 tadan oshmasin")
		return
	}
	rule := domain.AutomationRule{TriggerType: "comment_created", MatchMode: input.MatchMode, Keywords: input.Keywords, Exclusions: input.Exclusions, MediaScope: "all", IsActive: true}
	keyword, matched := rules.MatchKeyword(rule, domain.CommentEvent{Text: input.Text, MediaID: "preview-only"})
	expectedAction := "none"
	if matched {
		expectedAction = "private_reply_then_public_reply"
	}
	respond(w, http.StatusOK, map[string]any{
		"original_comment":    input.Text,
		"normalized_comment":  rules.Normalize(input.Text),
		"matched":             matched,
		"matched_keyword":     keyword,
		"normalized_keyword":  rules.Normalize(keyword),
		"selected_automation": strings.TrimSpace(input.Name),
		"expected_action":     expectedAction,
		"sends_message":       false,
	})
}

func (s *Server) previewMatch(rule domain.AutomationRule, text string) bool {
	return rules.Matches(rule, domain.CommentEvent{Text: text, MediaID: "preview"})
}

