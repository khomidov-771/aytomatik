package worker

import (
	"testing"

	"github.com/ids-automate/ids-automate/api/internal/domain"
)

func TestDecideWorkflow(t *testing.T) {
	rule := domain.AutomationRule{
		PublicSuccessReplyText:     "success",
		PublicNotFollowerReplyText: "not-follower",
		PublicUnknownReplyText:     "unknown",
		FollowVerificationEnabled:  true,
		UnknownFallbackPolicy:      "skip_dm_neutral_reply",
	}
	tests := []struct {
		name        string
		status      domain.FollowerStatus
		enabled     bool
		fallback    string
		sendPrivate bool
		publicText  string
	}{
		{name: "verification disabled", status: domain.FollowerNotChecked, enabled: false, fallback: "skip_dm_neutral_reply", sendPrivate: true, publicText: "success"},
		{name: "follower", status: domain.Follower, enabled: true, fallback: "skip_dm_neutral_reply", sendPrivate: true, publicText: "success"},
		{name: "not follower", status: domain.NotFollower, enabled: true, fallback: "skip_dm_neutral_reply", sendPrivate: false, publicText: "not-follower"},
		{name: "unknown skip", status: domain.FollowerUnknown, enabled: true, fallback: "skip_dm_neutral_reply", sendPrivate: false, publicText: "unknown"},
		{name: "unknown send", status: domain.FollowerUnknown, enabled: true, fallback: "send_private_reply", sendPrivate: true, publicText: "success"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			rule.FollowVerificationEnabled = test.enabled
			rule.UnknownFallbackPolicy = test.fallback
			decision := decideWorkflow(rule, test.status)
			if decision.SendPrivate != test.sendPrivate || decision.PublicText != test.publicText {
				t.Fatalf("unexpected decision: %#v", decision)
			}
		})
	}
}
