package provider

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/domain"
)

func TestPrivateReplyUsesOfficialCommentRecipient(t *testing.T) {
	for _, test := range []struct {
		name, loginMode, host string
	}{
		{name: "Instagram Login", loginMode: "instagram", host: "graph.instagram.com"},
		{name: "Unified Login", loginMode: "unified", host: "graph.facebook.com"},
	} {
		t.Run(test.name, func(t *testing.T) {
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				if request.Method != http.MethodPost || request.URL.Host != test.host || request.URL.Path != "/v25.0/ig-1/messages" {
					t.Fatalf("unexpected private reply endpoint: %s %s", request.Method, request.URL.String())
				}
				if request.Header.Get("Authorization") != "Bearer token" {
					t.Fatal("private reply did not use bearer token")
				}
				var payload struct {
					Recipient map[string]string `json:"recipient"`
					Message   map[string]string `json:"message"`
				}
				if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
					t.Fatalf("private reply payload was invalid: %v", err)
				}
				if payload.Recipient["comment_id"] != "comment-1" || payload.Recipient["id"] != "" || payload.Message["text"] != "DM text" {
					t.Fatalf("unexpected private reply payload: %#v", payload)
				}
				return jsonResponse(200, `{"message_id":"private-1"}`), nil
			})}
			p := &Meta{cfg: config.Config{MetaAPIVersion: "v25.0", MetaLoginMode: test.loginMode}, client: client}
			delivery, err := p.SendPrivateReply(context.Background(), "token", "ig-1", "comment-1", "DM text")
			if err != nil || delivery.MessageID != "private-1" {
				t.Fatalf("private reply failed: %#v %v", delivery, err)
			}
		})
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
}

func TestUnifiedAuthorizationURLUsesConfigurationID(t *testing.T) {
	p := &Meta{cfg: config.Config{
		MetaAppID:         "123456",
		MetaLoginMode:     "unified",
		MetaLoginConfigID: "2331645327602552",
		MetaRedirectURI:   "https://automate.example.com/api/v1/instagram/callback",
	}}
	raw, err := p.AuthorizationURL("oauth-state")
	if err != nil {
		t.Fatalf("authorization URL failed: %v", err)
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("authorization URL is invalid: %v", err)
	}
	query := parsed.Query()
	if parsed.Host != "www.facebook.com" || parsed.Path != "/dialog/oauth" || query.Get("config_id") != "2331645327602552" || query.Get("state") != "oauth-state" {
		t.Fatalf("unexpected unified authorization URL: %s", raw)
	}
	if query.Has("scope") {
		t.Fatalf("unified configuration must own scopes, got explicit scope in %s", raw)
	}
}

func TestUnifiedOAuthExchangeSubscriptionAndMessageDelivery(t *testing.T) {
	requests := []string{}
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		requests = append(requests, request.Method+" "+request.URL.Path)
		switch {
		case request.Method == http.MethodGet && request.URL.Path == "/v25.0/oauth/access_token":
			if request.URL.Query().Get("code") != "authorization-code" || request.URL.Query().Get("client_secret") != "app-secret" {
				t.Fatalf("token exchange parameters are incomplete")
			}
			return jsonResponse(200, `{"access_token":"access-secret","expires_in":3600}`), nil
		case request.Method == http.MethodGet && request.URL.Path == "/v25.0/me/assigned_instagram_accounts":
			if request.Header.Get("Authorization") != "Bearer access-secret" {
				t.Fatalf("account discovery did not use bearer token")
			}
			return jsonResponse(200, `{"data":[{"id":"ig-1","username":"ids.business","profile_picture_url":"https://example.com/avatar.jpg"}],"paging":{"cursors":{}}}`), nil
		case request.Method == http.MethodPost && request.URL.Path == "/v25.0/ig-1/subscribed_apps":
			return jsonResponse(200, `{"success":true}`), nil
		case request.Method == http.MethodGet && request.URL.Path == "/v25.0/me/permissions":
			return jsonResponse(200, `{"data":[{"permission":"instagram_basic","status":"granted"},{"permission":"denied_scope","status":"declined"}]}`), nil
		case request.Method == http.MethodPost && request.URL.Path == "/v25.0/ig-1/messages":
			return jsonResponse(200, `{"message_id":"mid-live-shaped"}`), nil
		case request.Method == http.MethodPost && request.URL.Path == "/v25.0/comment-1/replies":
			return jsonResponse(200, `{"id":"public-reply-1"}`), nil
		default:
			t.Fatalf("unexpected Meta request: %s %s", request.Method, request.URL.String())
			return nil, nil
		}
	})}
	p := &Meta{cfg: config.Config{
		MetaAppID:       "app-id",
		MetaAppSecret:   "app-secret",
		MetaAPIVersion:  "v25.0",
		MetaLoginMode:   "unified",
		MetaRedirectURI: "https://automate.example.com/api/v1/instagram/callback",
	}, client: client}

	account, err := p.ExchangeCode(context.Background(), "authorization-code")
	if err != nil {
		t.Fatalf("unified exchange failed: %v", err)
	}
	if account.ID != "ig-1" || account.Username != "ids.business" || account.AccessToken != "access-secret" || account.ExpiresAt == nil {
		t.Fatalf("unexpected account: %#v", account)
	}
	if account.AccountType != "UNKNOWN" {
		t.Fatalf("unified account type should remain unknown when Meta omits it, got %q", account.AccountType)
	}
	if len(account.Scopes) != 1 || account.Scopes[0] != "instagram_basic" {
		t.Fatalf("only granted permissions should be stored: %#v", account.Scopes)
	}
	delivery, err := p.SendMessage(context.Background(), account.AccessToken, account.ID, "customer-1", "Salom")
	if err != nil || delivery.MessageID != "mid-live-shaped" {
		t.Fatalf("unified message delivery failed: %#v %v", delivery, err)
	}
	publicReply, err := p.SendPublicCommentReply(context.Background(), account.AccessToken, "comment-1", "DM yuborildi")
	if err != nil || publicReply.MessageID != "public-reply-1" {
		t.Fatalf("public comment reply failed: %#v %v", publicReply, err)
	}
	status, err := p.CheckFollowerStatus(context.Background(), account.AccessToken, "customer-1", []string{"instagram_business_manage_messages"})
	if err == nil || status != domain.FollowerUnknown {
		t.Fatalf("unified login must not claim follow verification: %s %v", status, err)
	}
	if len(requests) != 6 {
		t.Fatalf("unexpected request sequence: %#v", requests)
	}
}

func TestListMediaUsesConnectedAccountAndOfficialMediaEdge(t *testing.T) {
	for _, test := range []struct {
		name, loginMode, host string
	}{
		{name: "Instagram Login", loginMode: "instagram", host: "graph.instagram.com"},
		{name: "Unified Login", loginMode: "unified", host: "graph.facebook.com"},
	} {
		t.Run(test.name, func(t *testing.T) {
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				if request.Method != http.MethodGet || request.URL.Host != test.host || request.URL.Path != "/v25.0/ig-1/media" {
					t.Fatalf("unexpected media endpoint: %s %s", request.Method, request.URL.String())
				}
				if request.Header.Get("Authorization") != "Bearer token" || request.URL.Query().Get("limit") != "50" {
					t.Fatal("media request did not use the connected account authorization")
				}
				fields := request.URL.Query().Get("fields")
				for _, expected := range []string{"id", "caption", "media_type", "media_product_type", "thumbnail_url", "permalink", "timestamp"} {
					if !strings.Contains(fields, expected) {
						t.Fatalf("media request is missing %s: %s", expected, fields)
					}
				}
				return jsonResponse(200, `{"data":[{"id":"media-1","caption":"Yangi mahsulot","media_type":"VIDEO","media_product_type":"REELS","media_url":"https://cdn.example.com/video.mp4","thumbnail_url":"https://cdn.example.com/cover.jpg","permalink":"https://www.instagram.com/reel/example/","timestamp":"2026-11-10T08:00:00Z"},{"caption":"missing id"}]}`), nil
			})}
			p := &Meta{cfg: config.Config{MetaAPIVersion: "v25.0", MetaLoginMode: test.loginMode}, client: client}
			items, err := p.ListMedia(context.Background(), "token", "ig-1")
			if err != nil || len(items) != 1 {
				t.Fatalf("media list failed: %#v %v", items, err)
			}
			if items[0].ID != "media-1" || items[0].MediaProductType != "REELS" || items[0].ThumbnailURL == "" || items[0].Timestamp.IsZero() {
				t.Fatalf("unexpected media: %#v", items[0])
			}
		})
	}
}

func TestSafeProviderURLRequiresHTTPS(t *testing.T) {
	if got := safeProviderURL("https://scontent.cdninstagram.com/image.jpg"); got == "" {
		t.Fatal("valid HTTPS media URL was rejected")
	}
	for _, raw := range []string{"javascript:alert(1)", "http://example.com/image.jpg", "//example.com/image.jpg", "not a url"} {
		if got := safeProviderURL(raw); got != "" {
			t.Fatalf("unsafe provider URL accepted: %q", got)
		}
	}
}

func TestInstagramLoginFollowerStatusIsThreeState(t *testing.T) {
	response := `{"is_user_follow_business":true}`
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Method != http.MethodGet || request.URL.Path != "/v25.0/customer-1" || request.URL.Query().Get("fields") != "is_user_follow_business" {
			t.Fatalf("unexpected follower request: %s %s", request.Method, request.URL.String())
		}
		return jsonResponse(200, response), nil
	})}
	p := &Meta{cfg: config.Config{MetaAPIVersion: "v25.0", MetaLoginMode: "instagram"}, client: client}
	status, err := p.CheckFollowerStatus(context.Background(), "token", "customer-1", []string{"instagram_business_manage_messages"})
	if err != nil || status != domain.Follower {
		t.Fatalf("confirmed follower was not returned: %s %v", status, err)
	}
	response = `{"is_user_follow_business":false}`
	status, err = p.CheckFollowerStatus(context.Background(), "token", "customer-1", []string{"instagram_business_manage_messages"})
	if err != nil || status != domain.NotFollower {
		t.Fatalf("confirmed non-follower was not returned: %s %v", status, err)
	}
	response = `{}`
	status, err = p.CheckFollowerStatus(context.Background(), "token", "customer-1", []string{"instagram_business_manage_messages"})
	if err == nil || status != domain.FollowerUnknown {
		t.Fatalf("missing field must be UNKNOWN: %s %v", status, err)
	}
	status, err = p.CheckFollowerStatus(context.Background(), "token", "customer-1", nil)
	if err == nil || status != domain.FollowerUnknown {
		t.Fatalf("missing permission must be UNKNOWN: %s %v", status, err)
	}
}

func TestWebhookSignature(t *testing.T) {
	body := []byte(`{"entry":[]}`)
	secret := "webhook-secret"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	p := &Meta{cfg: config.Config{WebhookAppSecret: secret}}
	if !p.VerifyWebhook(body, signature) {
		t.Fatal("valid signature rejected")
	}
	if p.VerifyWebhook(body, signature+"0") {
		t.Fatal("invalid signature accepted")
	}
}
func TestMockParseNormalizedEvent(t *testing.T) {
	events, err := (&Mock{}).ParseWebhook([]byte(`{"account_id":"a1","comment_id":"c1","media_id":"m1","text":"Narx","username":"aziza"}`))
	if err != nil || len(events) != 1 || events[0].Type != domain.ProviderEventComment || events[0].Comment.ProviderEventID != "comment:c1" {
		t.Fatalf("unexpected parse result: %#v %v", events, err)
	}
}

func TestParseInboundMessage(t *testing.T) {
	raw := []byte(`{"object":"instagram","entry":[{"id":"ig-account","messaging":[{"sender":{"id":"customer-1"},"recipient":{"id":"ig-account"},"timestamp":1735689600000,"message":{"mid":"mid.123","text":"Salom"}}]}]}`)
	events, err := parseEvents(raw)
	if err != nil || len(events) != 1 || events[0].Type != domain.ProviderEventInboundMessage {
		t.Fatalf("unexpected parse result: %#v %v", events, err)
	}
	message := events[0].Message
	if message == nil || message.AccountID != "ig-account" || message.ParticipantID != "customer-1" || message.ProviderMessageID != "mid.123" || message.Text != "Salom" {
		t.Fatalf("unexpected message: %#v", message)
	}
	if !message.CreatedAt.Equal(time.UnixMilli(1735689600000)) {
		t.Fatalf("unexpected timestamp: %s", message.CreatedAt)
	}
}

func TestParseMetaCommentUsesNestedMediaID(t *testing.T) {
	raw := []byte(`{"object":"instagram","entry":[{"id":"ig-account","time":1735689600,"changes":[{"field":"comments","value":{"id":"comment-1","text":"Narx","from":{"id":"customer-1","username":"aziza"},"media":{"id":"media-1"}}}]}]}`)
	events, err := parseEvents(raw)
	if err != nil || len(events) != 1 || events[0].Comment == nil {
		t.Fatalf("unexpected comment parse result: %#v %v", events, err)
	}
	comment := events[0].Comment
	if comment.AccountID != "ig-account" || comment.MediaID != "media-1" || comment.ParticipantID != "customer-1" {
		t.Fatalf("unexpected normalized comment: %#v", comment)
	}
}

func TestParseIgnoresEchoAndSelfMessage(t *testing.T) {
	raw := []byte(`{"entry":[{"id":"ig-account","messaging":[{"sender":{"id":"customer-1"},"recipient":{"id":"ig-account"},"message":{"mid":"echo","text":"outbound","is_echo":true}},{"sender":{"id":"ig-account"},"recipient":{"id":"ig-account"},"message":{"mid":"self","text":"self"}}]}]}`)
	events, err := parseEvents(raw)
	if err != nil || len(events) != 0 {
		t.Fatalf("echo/self messages must be ignored: %#v %v", events, err)
	}
}
