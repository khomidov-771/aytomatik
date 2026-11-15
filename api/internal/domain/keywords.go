package domain

// IDs remain stable through edits. Execution history stores an immutable
// snapshot so removing a template does not erase its delivery history.
type KeywordVariant struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"`
	Text    string `json:"text"`
	Enabled bool   `json:"enabled"`
}

type ReplyTemplate struct {
	ID      string `json:"id"`
	Text    string `json:"text"`
	Enabled bool   `json:"enabled"`
}

type KeywordGroup struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Priority         int               `json:"priority"`
	Enabled          bool              `json:"enabled"`
	FuzzyEnabled     bool              `json:"fuzzy_enabled"`
	FuzzyMaxDistance int               `json:"fuzzy_max_distance"`
	Variants         []KeywordVariant  `json:"variants"`
	DMTemplates      []ReplyTemplate   `json:"dm_templates"`
	PublicTemplates  []ReplyTemplate   `json:"public_templates"`
	Variables        map[string]string `json:"variables"`
}

type KeywordMatch struct {
	GroupID     string `json:"group_id"`
	GroupName   string `json:"group_name"`
	VariantID   string `json:"variant_id"`
	VariantKind string `json:"variant_kind"`
	Keyword     string `json:"keyword"`
	Normalized  string `json:"normalized_keyword"`
	MatchedText string `json:"matched_text"`
	MatchType   string `json:"match_type"`
	Distance    int    `json:"distance"`
	Priority    int    `json:"priority"`
}
