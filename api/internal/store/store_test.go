package store

import (
	"testing"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

func TestNormalizeRule(t *testing.T) {
	rule, err := normalizeRule(domain.AutomationRule{Name: "  Narx  ", MatchMode: "contains", Keywords: []string{" narx ", "NARX"}, MediaScope: "all", MediaIDs: []string{"ignored"}, ReplyText: " javob ", Priority: 100})
	if err != nil {
		t.Fatal(err)
	}
	if rule.Name != "Narx" || rule.ReplyText != "javob" || len(rule.Keywords) != 1 || len(rule.MediaIDs) != 0 {
		t.Fatalf("rule was not normalized: %#v", rule)
	}
}

func TestNormalizeRuleLimits(t *testing.T) {
	base := domain.AutomationRule{Name: "Narx", MatchMode: "contains", Keywords: []string{"narx"}, MediaScope: "selected", ReplyText: "javob", Priority: 100}
	if _, err := normalizeRule(base); err == nil {
		t.Fatal("selected scope without media IDs must fail")
	}
	base.MediaIDs = []string{"1"}
	base.Priority = 1001
	if _, err := normalizeRule(base); err == nil {
		t.Fatal("priority above the limit must fail")
	}
}
