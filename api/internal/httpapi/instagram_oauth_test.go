package httpapi

import (
	"net/http"
	"testing"

	"github.com/ids-automate/ids-automate/api/internal/provider"
)

func TestInstagramOAuthFailureCodeRejectsIncompleteAccounts(t *testing.T) {
	tests := []struct {
		name    string
		account provider.Account
		want    string
	}{
		{name: "missing token", account: provider.Account{ID: "ig-1"}, want: "oauth_token_exchange_failed"},
		{name: "missing account", account: provider.Account{AccessToken: "token"}, want: "instagram_asset_access_failed"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := instagramOAuthFailureCode(nil, test.account); got != test.want {
				t.Fatalf("unexpected OAuth failure code: got %q, want %q", got, test.want)
			}
		})
	}
}

func TestInstagramOAuthFailureCodePreservesProviderStage(t *testing.T) {
	err := &provider.APIError{StatusCode: http.StatusForbidden, Code: 10, Stage: "asset_discovery"}
	if got := instagramOAuthFailureCode(err, provider.Account{}); got != "instagram_asset_access_failed" {
		t.Fatalf("unexpected OAuth failure code: %q", got)
	}
}
