package domain

import (
	"encoding/json"
	"time"
)

type Principal struct {
	UserID           string    `json:"user_id"`
	Name             string    `json:"name"`
	Email            string    `json:"email"`
	WorkspaceID      string    `json:"workspace_id"`
	Workspace        string    `json:"workspace_name"`
	Role             string    `json:"role"`
	LoginProvider    string    `json:"login_provider,omitempty"`
	SessionID        string    `json:"-"`
	SessionExpiresAt time.Time `json:"-"`
	CSRFToken        string    `json:"csrf_token"`
}

type InstagramAccount struct {
	ID              string     `json:"id"`
	InstagramUserID string     `json:"instagram_user_id"`
	Username        string     `json:"username"`
	AccountType     string     `json:"account_type"`
	AvatarURL       string     `json:"avatar_url,omitempty"`
	Status          string     `json:"status"`
	Provider        string     `json:"provider"`
	Scopes          []string   `json:"scopes"`
	TokenExpiresAt  *time.Time `json:"token_expires_at,omitempty"`
	ConnectedAt     time.Time  `json:"connected_at"`
	LastSyncAt      *time.Time `json:"last_sync_at,omitempty"`
}

type AutomationRule struct {
	ID                         string    `json:"id"`
	InstagramAccountID         string    `json:"instagram_account_id"`
	AccountUsername            string    `json:"account_username,omitempty"`
	Name                       string    `json:"name"`
	TriggerType                string    `json:"trigger_type"`
	MatchMode                  string    `json:"match_mode"`
	Keywords                   []string  `json:"keywords"`
	Exclusions                 []string  `json:"exclusions"`
	MediaScope                 string    `json:"media_scope"`
	MediaIDs                   []string  `json:"media_ids"`
	PrivateReplyText           string    `json:"private_reply_text"`
	PublicSuccessReplyText     string    `json:"public_success_reply_text"`
	PublicNotFollowerReplyText string    `json:"public_not_follower_reply_text"`
	PublicUnknownReplyText     string    `json:"public_unknown_reply_text"`
	FollowVerificationEnabled  bool      `json:"follow_verification_enabled"`
	UnknownFallbackPolicy      string    `json:"unknown_fallback_policy"`
	IsActive                   bool      `json:"is_active"`
	Priority                   int       `json:"priority"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`
}

type FollowerStatus string

const (
	FollowerNotChecked FollowerStatus = "NOT_CHECKED"
	Follower           FollowerStatus = "FOLLOWER"
	NotFollower        FollowerStatus = "NOT_FOLLOWER"
	FollowerUnknown    FollowerStatus = "UNKNOWN"
)

type ExecutionAction struct {
	ActionType       string     `json:"action_type"`
	Status           string     `json:"status"`
	MessageText      string     `json:"message_text,omitempty"`
	Outcome          string     `json:"outcome,omitempty"`
	ProviderResultID string     `json:"provider_result_id,omitempty"`
	ErrorCode        string     `json:"error_code,omitempty"`
	ErrorMessage     string     `json:"error_message,omitempty"`
	AttemptCount     int        `json:"attempt_count"`
	StartedAt        time.Time  `json:"started_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
}

type AutomationExecution struct {
	ID           string            `json:"id"`
	RuleID       string            `json:"rule_id"`
	CommentID    string            `json:"comment_id"`
	CommentText  string            `json:"comment_text"`
	Username     string            `json:"username"`
	Status       string            `json:"status"`
	FollowStatus FollowerStatus    `json:"follow_status"`
	ErrorCode    string            `json:"error_code,omitempty"`
	ErrorMessage string            `json:"error_message,omitempty"`
	ReceivedAt   time.Time         `json:"received_at"`
	CompletedAt  *time.Time        `json:"completed_at,omitempty"`
	Actions      []ExecutionAction `json:"actions"`
}

type CommentEvent struct {
	ProviderEventID string          `json:"provider_event_id"`
	AccountID       string          `json:"account_id"`
	CommentID       string          `json:"comment_id"`
	MediaID         string          `json:"media_id"`
	Text            string          `json:"text"`
	Username        string          `json:"username"`
	ParticipantID   string          `json:"participant_id"`
	CreatedAt       time.Time       `json:"created_at"`
	IsLive          bool            `json:"is_live"`
	RawRedacted     json.RawMessage `json:"-"`
}

const (
	ProviderEventComment        = "comment"
	ProviderEventInboundMessage = "inbound_message"
)

// ProviderEvent is the normalized, provider-neutral webhook envelope.
// Exactly one payload is populated for a supported event type.
type ProviderEvent struct {
	Type    string               `json:"type"`
	Comment *CommentEvent        `json:"comment,omitempty"`
	Message *InboundMessageEvent `json:"message,omitempty"`
}

// InboundMessageEvent represents a message sent by an Instagram participant
// to the connected professional account. Only this event opens the 24-hour
// manual reply window; comment private replies never open it.
type InboundMessageEvent struct {
	ProviderEventID   string          `json:"provider_event_id"`
	AccountID         string          `json:"account_id"`
	ProviderMessageID string          `json:"provider_message_id"`
	ParticipantID     string          `json:"participant_id"`
	Username          string          `json:"username"`
	Text              string          `json:"text"`
	CreatedAt         time.Time       `json:"created_at"`
	RawRedacted       json.RawMessage `json:"-"`
}

type Metrics struct {
	Comments         int64   `json:"comments"`
	EligibleTriggers int64   `json:"eligible_triggers"`
	RepliesSent      int64   `json:"replies_sent"`
	Failures         int64   `json:"failures"`
	Conversion       float64 `json:"conversion"`
	Series           []Point `json:"series"`
}

type Point struct {
	Label    string `json:"label"`
	Comments int64  `json:"comments"`
	Replies  int64  `json:"replies"`
}
