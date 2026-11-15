package rules

import (
	"crypto/rand"
	"errors"
	"math/big"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

const MaxGroups = 100
const MaxVariants = 100
const MaxTemplates = 50

// MatchGroups returns one explainable best match per enabled group. The caller
// normalizes the incoming comment once and reuses it across candidate rules.
func MatchGroups(rule domain.AutomationRule, event domain.CommentEvent, text string) []domain.KeywordMatch {
	result := []domain.KeywordMatch{}
	if !rule.IsActive || rule.TriggerType != "comment_created" || text == "" {
		return result
	}
	if rule.MediaScope == "selected" && !contains(rule.MediaIDs, event.MediaID) {
		return result
	}
	for _, exclusion := range rule.Exclusions {
		if v := Normalize(exclusion); v != "" && strings.Contains(text, v) {
			return result
		}
	}
	if len(rule.KeywordGroups) == 0 {
		keyword, ok := flatKeyword(rule, text)
		if ok {
			result = append(result, domain.KeywordMatch{Keyword: keyword, Normalized: Normalize(keyword), MatchedText: Normalize(keyword), MatchType: "exact", VariantKind: "primary", Priority: rule.Priority})
		}
		return result
	}
	for _, group := range rule.KeywordGroups {
		if !group.Enabled {
			continue
		}
		var best *domain.KeywordMatch
		for _, v := range group.Variants {
			k := Normalize(v.Text)
			if !v.Enabled || k == "" {
				continue
			}
			exact := wholePhraseContains(text, k)
			if rule.MatchMode == "exact" {
				exact = text == k
			}
			if rule.MatchMode == "contains" {
				exact = strings.Contains(text, k)
			}
			if exact {
				m := domain.KeywordMatch{GroupID: group.ID, GroupName: group.Name, VariantID: v.ID, VariantKind: v.Kind, Keyword: v.Text, Normalized: k, MatchedText: k, MatchType: "exact", Priority: group.Priority}
				if best == nil || len([]rune(k)) > len([]rune(best.Normalized)) {
					best = &m
				}
			}
		}
		// Explicit keywords/synonyms always win, including explicit typo variants.
		if best == nil && group.FuzzyEnabled {
			for _, v := range group.Variants {
				if !v.Enabled {
					continue
				}
				k := Normalize(v.Text)
				fragment, distance, ok := fuzzyPhrase(text, k, group.FuzzyMaxDistance, rule.MatchMode == "exact")
				if ok && (best == nil || distance < best.Distance || (distance == best.Distance && len(k) > len(best.Normalized))) {
					m := domain.KeywordMatch{GroupID: group.ID, GroupName: group.Name, VariantID: v.ID, VariantKind: v.Kind, Keyword: v.Text, Normalized: k, MatchedText: fragment, MatchType: "fuzzy", Distance: distance, Priority: group.Priority}
					best = &m
				}
			}
		}
		if best != nil {
			result = append(result, *best)
		}
	}
	sort.SliceStable(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.MatchType != b.MatchType {
			return a.MatchType == "exact"
		}
		if a.Priority != b.Priority {
			return a.Priority < b.Priority
		}
		if a.Distance != b.Distance {
			return a.Distance < b.Distance
		}
		return len([]rune(a.Normalized)) > len([]rune(b.Normalized))
	})
	return result
}

func fuzzyPhrase(text, keyword string, threshold int, exact bool) (string, int, bool) {
	if threshold < 1 || threshold > 2 {
		return "", 0, false
	}
	words, wanted := strings.Fields(text), strings.Fields(keyword)
	if len(wanted) == 0 || len(wanted) > len(words) || (exact && len(wanted) != len(words)) {
		return "", 0, false
	}
	best, bestDistance := "", threshold+1
	for start := 0; start+len(wanted) <= len(words); start++ {
		distance, valid := 0, true
		for i, k := range wanted {
			w := words[start+i]
			if w == k {
				continue
			}
			a, b := []rune(k), []rune(w)
			// No typo guessing for short words, first-letter changes, or affix
			// extensions (narx/narxi). Those must be configured explicitly.
			if len(a) < 4 || len(b) < 4 || a[0] != b[0] || strings.HasPrefix(k, w) || strings.HasPrefix(w, k) {
				valid = false
				break
			}
			limit := threshold
			if len(a) < 7 {
				limit = 1
			}
			if len(a)-len(b) > limit || len(b)-len(a) > limit {
				valid = false
				break
			}
			d := editDistance(a, b, limit)
			if d > limit || d*4 > len(a) {
				valid = false
				break
			}
			distance += d
		}
		if valid && distance > 0 && distance < bestDistance {
			bestDistance, best = distance, strings.Join(words[start:start+len(wanted)], " ")
		}
	}
	return best, bestDistance, best != "" && bestDistance <= threshold
}

// Optimal string alignment distance counts adjacent transpositions as one edit.
func editDistance(a, b []rune, limit int) int {
	// Only diagonals within the threshold can produce an accepted match.
	if len(a) > 80 || len(b) > 80 {
		return limit + 1
	}
	var first, second, third [82]int
	last2, last, row := &first, &second, &third
	for j := 0; j <= len(b); j++ {
		last[j] = j
	}
	for i := 1; i <= len(a); i++ {
		lo, hi := max(1, i-limit), min(len(b), i+limit)
		row[0] = i
		if lo > 1 {
			row[lo-1] = limit + 1
		}
		for j := lo; j <= hi; j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			row[j] = min(last[j]+1, row[j-1]+1, last[j-1]+cost)
			if i > 1 && j > 1 && a[i-1] == b[j-2] && a[i-2] == b[j-1] {
				row[j] = min(row[j], last2[j-2]+1)
			}
		}
		row[hi+1] = limit + 1
		last2, last, row = last, row, last2
	}
	return last[len(b)]
}

// ToCyrillic is the conventional Uzbek Latin -> Cyrillic display conversion.
// Matching uses one canonical Latin form; Russian transliteration is inherently
// lossy (e/э and i/ы), so this is not used to rewrite source comments.
func ToCyrillic(value string) string {
	value = Normalize(value)
	pairs := strings.NewReplacer("o'", "ў", "g'", "ғ", "shch", "щ", "sh", "ш", "ch", "ч", "yo", "ё", "yu", "ю", "ya", "я", "ye", "е", "ts", "ц")
	value = pairs.Replace(value)
	var out strings.Builder
	mapping := map[rune]rune{'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'j': 'ж', 'z': 'з', 'i': 'и', 'y': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'x': 'х', 'h': 'ҳ', 'e': 'е', 'q': 'қ', '\'': 'ъ'}
	var previous rune
	for _, r := range value {
		if r == 'e' && (previous == 0 || previous == ' ' || strings.ContainsRune("aeiouў", previous)) {
			out.WriteRune('э')
		} else if c, ok := mapping[r]; ok {
			out.WriteRune(c)
		} else {
			out.WriteRune(r)
		}
		previous = r
	}
	return out.String()
}

var variablePattern = regexp.MustCompile(`\{\{\s*([a-zA-Z][a-zA-Z0-9_]{0,39})\s*\}\}`)

func RenderTemplate(text string, variables map[string]string) (string, error) {
	missing := false
	result := variablePattern.ReplaceAllStringFunc(text, func(match string) string {
		key := variablePattern.FindStringSubmatch(match)[1]
		value, ok := variables[key]
		if !ok {
			missing = true
		}
		return value
	})
	if missing || strings.Contains(result, "{{") || strings.Contains(result, "}}") {
		return "", errors.New("invalid or missing template variable")
	}
	result = strings.TrimSpace(result)
	if utf8.RuneCountInString(result) > 1000 {
		return "", errors.New("rendered reply text is too long")
	}
	return result, nil
}

// SelectReply only considers enabled, non-empty templates. It is invoked for
// public replies only after private delivery succeeds. The ledger freezes the
// result before the provider call; retries reuse that stored result.
func SelectReply(rule domain.AutomationRule, matches []domain.KeywordMatch, public bool) (string, []string, error) {
	if len(rule.KeywordGroups) == 0 {
		if public {
			return strings.TrimSpace(rule.PublicSuccessReplyText), []string{}, nil
		}
		return strings.TrimSpace(rule.PrivateReplyText), []string{}, nil
	}
	texts, ids := []string{}, []string{}
	for _, match := range matches {
		var group *domain.KeywordGroup
		for i := range rule.KeywordGroups {
			if rule.KeywordGroups[i].ID == match.GroupID {
				group = &rule.KeywordGroups[i]
				break
			}
		}
		if group == nil {
			return "", nil, errors.New("matched group unavailable")
		}
		templates := group.DMTemplates
		if public {
			templates = group.PublicTemplates
		}
		active := []domain.ReplyTemplate{}
		for _, tpl := range templates {
			if tpl.Enabled && strings.TrimSpace(tpl.Text) != "" {
				rendered, err := RenderTemplate(tpl.Text, group.Variables)
				if err != nil {
					return "", nil, err
				}
				if rendered != "" {
					tpl.Text = rendered
					active = append(active, tpl)
				}
			}
		}
		if len(active) == 0 {
			if public {
				return "", []string{}, nil
			}
			return "", nil, errors.New("no enabled private reply template")
		}
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(active))))
		if err != nil {
			return "", nil, err
		}
		chosen := active[n.Int64()]
		texts = append(texts, chosen.Text)
		ids = append(ids, chosen.ID)
		// One public acknowledgement for the primary group, even in combine mode.
		if public || !rule.CombineGroupReplies {
			break
		}
	}
	result := strings.Join(texts, "\n\n")
	if utf8.RuneCountInString(result) > 1000 {
		return "", nil, errors.New("combined private reply is too long")
	}
	return result, ids, nil
}
