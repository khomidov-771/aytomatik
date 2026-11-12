package rules

import (
	"testing"

	"github.com/ids-automate/ids-automate/api/internal/domain"
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

func TestUzbekLatinCyrillicWholeWordMatches(t *testing.T) {
	rule := domain.AutomationRule{TriggerType: "comment_created", MatchMode: "keyword_list", Keywords: []string{"olov"}, MediaScope: "all", IsActive: true}
	for _, comment := range []string{"olov", "OLOV", "Olov", "oLoV", "Олов", "олов", "ОЛОВ", "Menga olov kerak", "Олов bormi?", "OLОV bormi?"} {
		t.Run(comment, func(t *testing.T) {
			if !Matches(rule, domain.CommentEvent{Text: comment}) {
				t.Fatalf("expected %q to match", comment)
			}
		})
	}
}

func TestWholeWordModeSupportsUzbekDigraphsAndPunctuation(t *testing.T) {
	rule := domain.AutomationRule{TriggerType: "comment_created", MatchMode: "keyword_list", Keywords: []string{"g‘isht", "ko‘ylak", "sharf", "chim"}, MediaScope: "all", IsActive: true}
	for keyword, comment := range map[string]string{"g‘isht": "Ғишт bormi?", "ko‘ylak": "Кўйлак kerak", "sharf": "Шарф", "chim": "Chim bor"} {
		if !Matches(rule, domain.CommentEvent{Text: comment}) {
			t.Errorf("expected %q (%q) to match", comment, keyword)
		}
	}
	if Matches(rule, domain.CommentEvent{Text: "g‘ishtli"}) {
		t.Fatal("whole-word mode matched a larger word")
	}
}

func TestContainsModeCanMatchPartOfWord(t *testing.T) {
	rule := domain.AutomationRule{TriggerType: "comment_created", MatchMode: "contains", Keywords: []string{"olov"}, MediaScope: "all", IsActive: true}
	if !Matches(rule, domain.CommentEvent{Text: "olovli"}) {
		t.Fatal("contains mode should allow partial-word matches")
	}
}

func TestMostSpecificKeywordIsReturned(t *testing.T) {
	rule := domain.AutomationRule{TriggerType: "comment_created", MatchMode: "keyword_list", Keywords: []string{"narx", "narx qancha"}, MediaScope: "all", IsActive: true}
	matched, ok := MatchKeyword(rule, domain.CommentEvent{Text: "Narx qancha?"})
	if !ok || matched != "narx qancha" {
		t.Fatalf("expected most specific keyword, got %q, matched=%v", matched, ok)
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
