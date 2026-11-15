package rules

import (
	"strings"
	"unicode"

	"golang.org/x/text/cases"
	"golang.org/x/text/unicode/norm"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

var apostrophes = strings.NewReplacer("’", "'", "‘", "'", "ʻ", "'", "ʼ", "'", "＇", "'", "ʹ", "'", "`", "'", "´", "'")

// Normalize produces one matching form for Uzbek Latin and Cyrillic text.
// It never changes the stored or displayed source comment.
func Normalize(value string) string {
	value = norm.NFC.String(value)
	value = cases.Fold().String(apostrophes.Replace(value))
	value = transliterateCyrillic(value)
	runes := []rune(value)
	var out strings.Builder
	for i, r := range runes {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSpace(r) {
			out.WriteRune(r)
			continue
		}
		if r == '\'' && i > 0 && (runes[i-1] == 'o' || runes[i-1] == 'g' || (i+1 < len(runes) && unicode.IsLetter(runes[i-1]) && unicode.IsLetter(runes[i+1]))) {
			out.WriteRune(r)
			continue
		}
		out.WriteByte(' ')
	}
	return strings.Join(strings.Fields(out.String()), " ")
}

func transliterateCyrillic(value string) string {
	var out strings.Builder
	var previous rune
	for _, r := range value {
		switch r {
		case 'а':
			out.WriteByte('a')
		case 'б':
			out.WriteByte('b')
		case 'в':
			out.WriteByte('v')
		case 'г':
			out.WriteByte('g')
		case 'ғ':
			out.WriteString("g'")
		case 'д':
			out.WriteByte('d')
		case 'е':
			if !unicode.IsLetter(previous) || strings.ContainsRune("аеиоуыэюяёьъўaeiou", previous) {
				out.WriteByte('y')
			}
			out.WriteByte('e')
		case 'ё':
			out.WriteString("yo")
		case 'ж':
			out.WriteByte('j')
		case 'з':
			out.WriteByte('z')
		case 'и':
			out.WriteByte('i')
		case 'й':
			out.WriteByte('y')
		case 'к':
			out.WriteByte('k')
		case 'қ':
			out.WriteByte('q')
		case 'л':
			out.WriteByte('l')
		case 'м':
			out.WriteByte('m')
		case 'н':
			out.WriteByte('n')
		case 'о':
			out.WriteByte('o')
		case 'ў':
			out.WriteString("o'")
		case 'п':
			out.WriteByte('p')
		case 'р':
			out.WriteByte('r')
		case 'с':
			out.WriteByte('s')
		case 'т':
			out.WriteByte('t')
		case 'у':
			out.WriteByte('u')
		case 'ф':
			out.WriteByte('f')
		case 'х':
			out.WriteByte('x')
		case 'ҳ':
			out.WriteByte('h')
		case 'ц':
			out.WriteString("ts")
		case 'ч':
			out.WriteString("ch")
		case 'ш':
			out.WriteString("sh")
		case 'щ':
			out.WriteString("shch")
		case 'ъ':
			out.WriteByte('\'')
		case 'ы':
			out.WriteByte('i')
		case 'ь':
			// Russian soft sign has no independent Uzbek Latin sound.
		case 'э':
			out.WriteByte('e')
		case 'ю':
			out.WriteString("yu")
		case 'я':
			out.WriteString("ya")
		default:
			out.WriteRune(r)
		}
		previous = r
	}
	return out.String()
}

func Matches(rule domain.AutomationRule, event domain.CommentEvent) bool {
	if len(rule.KeywordGroups) > 0 {
		return len(MatchGroups(rule, event, Normalize(event.Text))) > 0
	}
	_, matched := MatchKeyword(rule, event)
	return matched
}

// MatchKeyword returns the most specific configured keyword that matched.
// Exact/keyword_list use whole-word or whole-phrase boundaries; contains is
// available for owners who deliberately want partial-word matches.
func MatchKeyword(rule domain.AutomationRule, event domain.CommentEvent) (string, bool) {
	matches := MatchGroups(rule, event, Normalize(event.Text))
	if len(matches) == 0 {
		return "", false
	}
	return matches[0].Keyword, true
}

func flatKeyword(rule domain.AutomationRule, text string) (string, bool) {
	best := ""
	bestLength := 0
	for _, configured := range rule.Keywords {
		keyword := Normalize(configured)
		if keyword == "" {
			continue
		}
		matched := false
		switch rule.MatchMode {
		case "exact":
			matched = text == keyword
		case "contains":
			matched = strings.Contains(text, keyword)
		case "keyword_list":
			matched = wholePhraseContains(text, keyword)
		}
		length := len([]rune(keyword))
		if matched && length > bestLength {
			best, bestLength = configured, length
		}
	}
	return best, best != ""
}

func wholePhraseContains(text, phrase string) bool {
	return strings.Contains(" "+text+" ", " "+phrase+" ")
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
