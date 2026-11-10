package store

import (
	"testing"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

func TestNormalizeRule(t *testing.T) {
	rule, err := normalizeRule(domain.AutomationRule{Name: "  Narx  ", MatchMode: "contains", Keywords: []string{" narx ", "NARX"}, MediaScope: "all", MediaIDs: []string{"ignored"}, PrivateReplyText: " javob ", PublicSuccessReplyText: " yuborildi ", Priority: 100})
	if err != nil {
		t.Fatal(err)
	}
	if rule.Name != "Narx" || rule.PrivateReplyText != "javob" || rule.PublicSuccessReplyText != "yuborildi" || len(rule.Keywords) != 1 || len(rule.MediaIDs) != 0 {
		t.Fatalf("rule was not normalized: %#v", rule)
	}
}

func TestNormalizeRuleLimits(t *testing.T) {
	base := domain.AutomationRule{Name: "Narx", MatchMode: "contains", Keywords: []string{"narx"}, MediaScope: "selected", PrivateReplyText: "javob", PublicSuccessReplyText: "yuborildi", Priority: 100}
	if _, err := normalizeRule(base); err == nil {
		t.Fatal("selected scope without media IDs must fail")
	}
	base.MediaIDs = []string{"1"}
	base.Priority = 1001
	if _, err := normalizeRule(base); err == nil {
		t.Fatal("priority above the limit must fail")
	}
}

func TestNormalizeRuleRequiresExplicitUnknownFallback(t *testing.T) {
	base := domain.AutomationRule{
		Name:                       "Follow gate",
		MatchMode:                  "contains",
		Keywords:                   []string{"info"},
		MediaScope:                 "all",
		PrivateReplyText:           "DM",
		PublicSuccessReplyText:     "DM yuborildi",
		PublicNotFollowerReplyText: "Avval obuna bo‘ling",
		PublicUnknownReplyText:     "Direct orqali yozing",
		FollowVerificationEnabled:  true,
		UnknownFallbackPolicy:      "invalid",
		Priority:                   100,
	}
	if _, err := normalizeRule(base); err == nil {
		t.Fatal("invalid unknown fallback policy must fail")
	}
	base.UnknownFallbackPolicy = "skip_dm_neutral_reply"
	if _, err := normalizeRule(base); err != nil {
		t.Fatalf("valid follow rule rejected: %v", err)
	}
}
