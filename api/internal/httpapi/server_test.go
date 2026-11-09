package httpapi

import (
	"net/http/httptest"
	"testing"

	"github.com/ids-automate/ids-automate/api/internal/config"
)

func TestRoleAtLeast(t *testing.T) {
	tests := []struct {
		actual, required string
		allowed          bool
	}{
		{"owner", "customer", true},
		{"manager", "operator", true},
		{"operator", "manager", false},
		{"customer", "customer", true},
		{"", "customer", false},
	}
	for _, test := range tests {
		if got := roleAtLeast(test.actual, test.required); got != test.allowed {
			t.Errorf("roleAtLeast(%q,%q)=%v, want %v", test.actual, test.required, got, test.allowed)
		}
	}
}

func TestNormalizeEmailRejectsDisplayName(t *testing.T) {
	if _, ok := normalizeEmail("Attacker <user@example.com>"); ok {
		t.Fatal("display-name email must be rejected")
	}
	if got, ok := normalizeEmail(" User@Example.com "); !ok || got != "user@example.com" {
		t.Fatalf("plain mailbox was not normalized: %q, %v", got, ok)
	}
}

func TestClientIPOnlyTrustsConfiguredProxy(t *testing.T) {
	server := &Server{cfg: config.Config{TrustedProxyCIDRs: []string{"127.0.0.1/32"}}}
	request := httptest.NewRequest("GET", "/", nil)
	request.RemoteAddr = "203.0.113.4:1234"
	request.Header.Set("X-Real-IP", "198.51.100.9")
	if got := server.clientIP(request); got != "203.0.113.4" {
		t.Fatalf("untrusted proxy header accepted: %s", got)
	}
	request.RemoteAddr = "127.0.0.1:1234"
	if got := server.clientIP(request); got != "198.51.100.9" {
		t.Fatalf("trusted proxy header ignored: %s", got)
	}
}

func TestValidClientRequestID(t *testing.T) {
	if !validClientRequestID("550e8400-e29b-41d4-a716-446655440000") {
		t.Fatal("UUID-style id should be accepted")
	}
	if validClientRequestID("short") || validClientRequestID("550e8400-e29b-41d4-a716-44665544/000") {
		t.Fatal("unsafe id should be rejected")
	}
}
