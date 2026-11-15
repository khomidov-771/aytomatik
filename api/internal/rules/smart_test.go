package rules

import (
	"reflect"
	"strings"
	"testing"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

func TestSmartNormalization(t *testing.T) {
	for _, tc := range [][2]string{
		{"narx", "narx"}, {"Narx", "narx"}, {"NARX", "narx"}, {"НаРХ", "narx"}, {"нарх", "narx"}, {"NаРx!?", "narx"},
		{"  НАРХ,\t қанча?  ", "narx qancha"}, {"ўғил o‘g‘il oʼgʻil", "o'g'il o'g'il o'g'il"},
		{"и\u0306ул", "yul"}, {"ЁШ ЕТКАЗИБ БЕРИШ", "yosh yetkazib berish"}, {"Цена, сколько стоит?", "tsena skolko stoit"}, {"юқори ғишт", "yuqori g'isht"},
	} {
		t.Run(tc[0], func(t *testing.T) {
			if got := Normalize(tc[0]); got != tc[1] {
				t.Fatalf("%q != %q", got, tc[1])
			}
		})
	}
	for _, tc := range [][2]string{{"o'g'il", "ўғил"}, {"yetkazib berish", "етказиб бериш"}, {"narx qancha", "нарх қанча"}, {"e'lon", "эълон"}, {"yosh", "ёш"}} {
		t.Run("reverse_"+tc[0], func(t *testing.T) {
			if got := ToCyrillic(tc[0]); got != tc[1] || Normalize(got) != tc[0] {
				t.Fatalf("conversion %q -> %q -> %q", tc[0], got, Normalize(got))
			}
		})
	}
}

func smartRule() domain.AutomationRule {
	group := func(id string, priority int, primary string, synonyms ...string) domain.KeywordGroup {
		g := domain.KeywordGroup{ID: id, Name: id, Priority: priority, Enabled: true, FuzzyEnabled: true, FuzzyMaxDistance: 1, Variants: []domain.KeywordVariant{{Kind: "primary", Text: primary, Enabled: true}}, DMTemplates: []domain.ReplyTemplate{{ID: id + "-dm", Text: id, Enabled: true}}, PublicTemplates: []domain.ReplyTemplate{{ID: id + "-public", Text: "OK " + id, Enabled: true}}}
		for _, s := range synonyms {
			g.Variants = append(g.Variants, domain.KeywordVariant{Kind: "synonym", Text: s, Enabled: true})
		}
		return g
	}
	price := group("price", 2, "narx", "qancha", "narxi", "цена", "сколько стоит")
	price.Variants = append(price.Variants, domain.KeywordVariant{Kind: "typo", Text: "narhx", Enabled: true})
	return domain.AutomationRule{IsActive: true, TriggerType: "comment_created", MatchMode: "keyword_list", MediaScope: "all", KeywordGroups: []domain.KeywordGroup{price, group("delivery", 1, "dostavka", "yetkazib berish"), group("address", 3, "manzil", "qayerdasiz")}}
}

func TestSmartKeywordGroups(t *testing.T) {
	rule := smartRule()
	for _, tc := range []struct{ text, ids, kind string }{
		{"NARXI qancha va dostavka bormi?", "delivery,price", "exact"}, {"Narxi qancha? Qayerdasiz?", "price,address", "exact"}, {"сколько стоит?", "price", "exact"}, {"ЦЕНА", "price", "exact"}, {"narhx", "price", "exact"}, {"nrax", "price", "fuzzy"}, {"нарх?", "price", "exact"}, {"narx va dstavka", "price,delivery", "exact"}, {"narxning", "", ""}, {"barx", "", ""}, {"arx", "", ""}, {"no", "", ""}, {"manzillari", "", ""},
	} {
		t.Run(tc.text, func(t *testing.T) {
			got := MatchGroups(rule, domain.CommentEvent{}, Normalize(tc.text))
			var ids []string
			for _, m := range got {
				ids = append(ids, m.GroupID)
				if m.MatchedText == "" || m.Normalized == "" {
					t.Fatal("missing match evidence")
				}
			}
			if strings.Join(ids, ",") != tc.ids || (len(got) > 0 && got[0].MatchType != tc.kind) {
				t.Fatalf("unexpected %+v", got)
			}
		})
	}
	t.Run("disabled_or_excluded", func(t *testing.T) {
		r := smartRule()
		r.KeywordGroups[0].Enabled = false
		r.Exclusions = []string{"test"}
		for _, s := range []string{"narx", "dostavka test"} {
			if got := MatchGroups(r, domain.CommentEvent{}, Normalize(s)); len(got) != 0 {
				t.Fatal(got)
			}
		}
	})
	t.Run("threshold", func(t *testing.T) {
		if _, _, ok := fuzzyPhrase("dastafka", "dostavka", 1, false); ok {
			t.Fatal("threshold 1")
		}
		if _, d, ok := fuzzyPhrase("dastafka", "dostavka", 2, false); !ok || d != 2 {
			t.Fatal(d, ok)
		}
	})
	t.Run("explicit_suffix_only", func(t *testing.T) {
		if _, _, ok := fuzzyPhrase("narxi", "narx", 2, false); ok {
			t.Fatal("implicit synonym")
		}
	})
}

func TestSmartReplySelection(t *testing.T) {
	r := smartRule()
	matches := MatchGroups(r, domain.CommentEvent{}, "dostavka narx")
	for _, public := range []bool{false, true} {
		t.Run(map[bool]string{true: "public", false: "private"}[public], func(t *testing.T) {
			templates := []domain.ReplyTemplate{{ID: "off", Text: "off", Enabled: false}, {ID: "blank", Text: " ", Enabled: true}, {ID: "var", Text: "{{empty}}", Enabled: true}, {ID: "one", Text: "A {{price}}", Enabled: true}}
			g := &r.KeywordGroups[1]
			g.Variables = map[string]string{"empty": "", "price": "42"}
			if public {
				g.PublicTemplates = templates
			} else {
				g.DMTemplates = templates
			}
			text, ids, err := SelectReply(r, matches, public)
			if err != nil || text != "A 42" || !reflect.DeepEqual(ids, []string{"one"}) {
				t.Fatal(text, ids, err)
			}
			templates = append(templates, domain.ReplyTemplate{ID: "two", Text: "B", Enabled: true})
			if public {
				g.PublicTemplates = templates
			} else {
				g.DMTemplates = templates
			}
			for i := 0; i < 40; i++ {
				text, ids, err = SelectReply(r, matches, public)
				if err != nil || len(ids) != 1 || map[string]string{"one": "A 42", "two": "B"}[ids[0]] != text || text == "" {
					t.Fatal(text, ids, err)
				}
			}
		})
	}
	r = smartRule()
	r.CombineGroupReplies = true
	text, ids, err := SelectReply(r, matches, false)
	if err != nil || text != "delivery\n\nprice" || !reflect.DeepEqual(ids, []string{"delivery-dm", "price-dm"}) {
		t.Fatal(text, ids, err)
	}
	r.KeywordGroups[1].PublicTemplates = nil
	text, ids, err = SelectReply(r, matches, true)
	if err != nil || text != "" || len(ids) != 0 {
		t.Fatal(text, ids, err)
	}
}
