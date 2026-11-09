package rules

import (
	"github.com/ids-automate/ids-automate/api/internal/domain"
	"testing"
)

func TestMatchesNormalizesAndExcludes(t *testing.T) {
	rule := domain.AutomationRule{TriggerType: "comment_created", MatchMode: "contains", Keywords: []string{"NARX"}, Exclusions: []string{"bepul"}, MediaScope: "all", IsActive: true}
	if !Matches(rule, domain.CommentEvent{Text: "  Narxi qancha?! "}) {
		t.Fatal("normalized keyword did not match")
	}
	if Matches(rule, domain.CommentEvent{Text: "Bepul narx bormi?"}) {
		t.Fatal("exclusion did not win")
	}
}

func TestExactSelectedMediaAndWordMode(t *testing.T) {
	rule := domain.AutomationRule{TriggerType: "comment_created", MatchMode: "exact", Keywords: []string{"info"}, MediaScope: "selected", MediaIDs: []string{"m1"}, IsActive: true}
	if !Matches(rule, domain.CommentEvent{Text: "INFO!", MediaID: "m1"}) {
		t.Fatal("exact selected match failed")
	}
	if Matches(rule, domain.CommentEvent{Text: "info", MediaID: "m2"}) {
		t.Fatal("unselected media matched")
	}
	rule.MatchMode = "keyword_list"
	rule.MediaScope = "all"
	rule.Keywords = []string{"narx"}
	if Matches(rule, domain.CommentEvent{Text: "narxlar"}) {
		t.Fatal("word mode matched partial word")
	}
}
