package rules

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

var spaces = regexp.MustCompile(`\s+`)

func Normalize(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSpace(r) {
			return r
		}
		return ' '
	}, value)
	return strings.TrimSpace(spaces.ReplaceAllString(value, " "))
}

func Matches(rule domain.AutomationRule, event domain.CommentEvent) bool {
	if !rule.IsActive || rule.TriggerType != "comment_created" {
		return false
	}
	if rule.MediaScope == "selected" && !contains(rule.MediaIDs, event.MediaID) {
		return false
	}
	text := Normalize(event.Text)
	if text == "" {
		return false
	}
	for _, exclusion := range rule.Exclusions {
		if value := Normalize(exclusion); value != "" && strings.Contains(text, value) {
			return false
		}
	}
	for _, keyword := range rule.Keywords {
		keyword = Normalize(keyword)
		if keyword == "" {
			continue
		}
		switch rule.MatchMode {
		case "exact":
			if text == keyword {
				return true
			}
		case "contains":
			if strings.Contains(text, keyword) {
				return true
			}
		case "keyword_list":
			for _, token := range strings.Fields(text) {
				if token == keyword {
					return true
				}
			}
		}
	}
	return false
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
