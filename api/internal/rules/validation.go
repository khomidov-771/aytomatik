package rules

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
var variableName = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{0,39}$`)

// ValidateGroups is shared by persistence and preview. Preview validates the
// keyword portion only because message composition is a later builder step.
func ValidateGroups(groups []domain.KeywordGroup, preview, combine bool) error {
	if len(groups) > MaxGroups {
		return errors.New("invalid keyword groups: maximum 100")
	}
	ids := map[string]bool{}
	checkID := func(id string) bool {
		if id == "" {
			return true
		}
		if !uuidPattern.MatchString(id) || ids[id] {
			return false
		}
		ids[id] = true
		return true
	}
	totalVariants, totalTemplates, maxCombined, enabled := 0, 0, 0, 0
	for i := range groups {
		g := &groups[i]
		g.Name = strings.TrimSpace(g.Name)
		if !checkID(g.ID) || utf8.RuneCountInString(g.Name) < 1 || utf8.RuneCountInString(g.Name) > 80 || g.Priority < 1 || g.Priority > 1000 || g.FuzzyMaxDistance < 0 || g.FuzzyMaxDistance > 2 {
			return errors.New("invalid keyword group name, ID, priority or fuzzy distance")
		}
		if g.FuzzyEnabled && g.FuzzyMaxDistance == 0 {
			g.FuzzyMaxDistance = 1
		}
		if len(g.Variants) > MaxVariants || len(g.DMTemplates) > MaxTemplates || len(g.PublicTemplates) > MaxTemplates {
			return errors.New("invalid group size: maximum 100 variants and 50 templates per channel")
		}
		totalVariants += len(g.Variants)
		totalTemplates += len(g.DMTemplates) + len(g.PublicTemplates)
		primary := false
		for j := range g.Variants {
			v := &g.Variants[j]
			v.Text = strings.TrimSpace(v.Text)
			if !checkID(v.ID) || (v.Kind != "primary" && v.Kind != "synonym" && v.Kind != "typo") || Normalize(v.Text) == "" || utf8.RuneCountInString(v.Text) > 80 {
				return errors.New("invalid keyword variant")
			}
			if v.Enabled && v.Kind == "primary" {
				primary = true
			}
		}
		if g.Enabled {
			enabled++
			if !primary {
				return errors.New("enabled group primary keyword required")
			}
		}
		if len(g.Variables) > 20 {
			return errors.New("invalid template variables: maximum 20")
		}
		for k, v := range g.Variables {
			if !variableName.MatchString(k) || utf8.RuneCountInString(v) > 1000 {
				return errors.New("invalid template variable")
			}
		}
		activeDM, longest := 0, 0
		for channel, templates := range [][]domain.ReplyTemplate{g.DMTemplates, g.PublicTemplates} {
			for j := range templates {
				t := &templates[j]
				t.Text = strings.TrimSpace(t.Text)
				if !checkID(t.ID) || utf8.RuneCountInString(t.Text) > 1000 {
					return errors.New("invalid template ID or reply text too long")
				}
				if preview || !t.Enabled || t.Text == "" {
					continue
				}
				rendered, err := RenderTemplate(t.Text, g.Variables)
				if err != nil {
					return err
				}
				if rendered != "" && channel == 0 {
					activeDM++
					longest = max(longest, utf8.RuneCountInString(rendered))
				}
			}
		}
		if !preview && g.Enabled && activeDM == 0 {
			return errors.New("enabled group private reply template required")
		}
		if g.Enabled {
			maxCombined += longest
		}
	}
	if totalVariants > 2000 || totalTemplates > 1000 {
		return errors.New("invalid automation size: maximum 2000 variants and 1000 templates")
	}
	if !preview && combine && maxCombined+max(0, enabled-1)*2 > 1000 {
		return errors.New("combined private reply text is too long; reduce templates or disable combine")
	}
	return nil
}
