package provider

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/domain"
)

type Account struct {
	ID, Username, AccountType, AvatarURL, AccessToken string
	ExpiresAt                                         *time.Time
	Scopes                                            []string
}
type Delivery struct{ MessageID string }

// Media is the provider-neutral subset used by the automation builder. Access
// tokens and provider-only fields must never be returned to the browser.
type Media struct {
	ID               string    `json:"id"`
	Caption          string    `json:"caption,omitempty"`
	MediaType        string    `json:"media_type"`
	MediaProductType string    `json:"media_product_type,omitempty"`
	MediaURL         string    `json:"media_url,omitempty"`
	ThumbnailURL     string    `json:"thumbnail_url,omitempty"`
	Permalink        string    `json:"permalink,omitempty"`
	Timestamp        time.Time `json:"timestamp"`
}

type APIError struct {
	StatusCode int
	Code       int
	Type       string
	Retryable  bool
	Ambiguous  bool
}

func (e *APIError) Error() string {
	if e.StatusCode == 0 {
		return "Meta request outcome is unknown"
	}
	return fmt.Sprintf("Meta API error %d/%s", e.Code, e.Type)
}

func ErrorCode(err error) string {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		if apiErr.Ambiguous {
			return "provider_outcome_unknown"
		}
		if apiErr.StatusCode == http.StatusTooManyRequests {
			return "provider_rate_limited"
		}
		return "provider_rejected"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "provider_timeout"
	}
	return "provider_error"
}

func IsRetryable(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.Retryable && !apiErr.Ambiguous
}

func IsAmbiguous(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.Ambiguous
}

type Instagram interface {
	Name() string
	AuthorizationURL(state string) (string, error)
	ExchangeCode(ctx context.Context, code string) (Account, error)
	DisconnectAccount(ctx context.Context, accessToken, accountID string) error
	ListMedia(ctx context.Context, accessToken, accountID string) ([]Media, error)
	CheckFollowerStatus(ctx context.Context, accessToken, participantID string, scopes []string) (domain.FollowerStatus, error)
	SendPrivateReply(ctx context.Context, accessToken, accountID, commentID, text string) (Delivery, error)
	SendPublicCommentReply(ctx context.Context, accessToken, commentID, text string) (Delivery, error)
	SendMessage(ctx context.Context, accessToken, accountID, participantID, text string) (Delivery, error)
	VerifyWebhook(body []byte, signature string) bool
	ParseWebhook(body []byte) ([]domain.ProviderEvent, error)
}

func New(cfg config.Config) Instagram {
	if cfg.InstagramProvider == "meta" {
		return &Meta{cfg: cfg, client: &http.Client{Timeout: 15 * time.Second}}
	}
	return &Mock{apiURL: cfg.APIURL}
}

type Mock struct{ apiURL string }

func (m *Mock) Name() string { return "mock" }
func (m *Mock) AuthorizationURL(state string) (string, error) {
	return fmt.Sprintf("%s/api/v1/instagram/callback?code=mock-approved&state=%s", m.apiURL, url.QueryEscape(state)), nil
}
func (m *Mock) ExchangeCode(_ context.Context, code string) (Account, error) {
	if code != "mock-approved" {
		return Account{}, errors.New("mock authorization denied")
	}
	expiry := time.Now().Add(60 * 24 * time.Hour)
	return Account{ID: "mock-178414000000001", Username: "ids.demo", AccountType: "BUSINESS", AccessToken: "mock-access-token", ExpiresAt: &expiry, Scopes: []string{"instagram_business_basic", "instagram_business_manage_comments", "instagram_business_manage_messages"}}, nil
}
func (m *Mock) DisconnectAccount(_ context.Context, _, _ string) error { return nil }
func (m *Mock) ListMedia(_ context.Context, _, _ string) ([]Media, error) {
	return []Media{}, nil
}
func (m *Mock) CheckFollowerStatus(_ context.Context, _, participantID string, _ []string) (domain.FollowerStatus, error) {
	switch {
	case strings.Contains(participantID, "not-follower"):
		return domain.NotFollower, nil
	case strings.Contains(participantID, "unknown"):
		return domain.FollowerUnknown, errors.New("test follower status unavailable")
	default:
		return domain.Follower, nil
	}
}
func (m *Mock) SendPrivateReply(_ context.Context, _, _, commentID, text string) (Delivery, error) {
	if commentID == "fail" || strings.Contains(text, "[FAIL]") {
		return Delivery{}, errors.New("simulated provider failure")
	}
	return Delivery{MessageID: "test_dm_" + shortID(commentID)}, nil
}
func (m *Mock) SendPublicCommentReply(_ context.Context, _, commentID, text string) (Delivery, error) {
	if commentID == "fail-public" || strings.Contains(text, "[FAIL]") {
		return Delivery{}, errors.New("simulated public reply failure")
	}
	return Delivery{MessageID: "test_comment_" + shortID(commentID)}, nil
}
func (m *Mock) SendMessage(_ context.Context, _, _, participantID, text string) (Delivery, error) {
	if strings.Contains(text, "[FAIL]") {
		return Delivery{}, errors.New("simulated provider failure")
	}
	return Delivery{MessageID: "test_msg_" + shortID(participantID)}, nil
}
func (m *Mock) VerifyWebhook(_ []byte, _ string) bool { return true }
func (m *Mock) ParseWebhook(body []byte) ([]domain.ProviderEvent, error) {
	var direct domain.CommentEvent
	if json.Unmarshal(body, &direct) == nil && direct.CommentID != "" {
		if direct.CreatedAt.IsZero() {
			direct.CreatedAt = time.Now()
		}
		if direct.ProviderEventID == "" {
			direct.ProviderEventID = "comment:" + direct.CommentID
		}
		direct.RawRedacted = json.RawMessage(`{"redacted":true}`)
		return []domain.ProviderEvent{{Type: domain.ProviderEventComment, Comment: &direct}}, nil
	}
	return parseEvents(body)
}

type Meta struct {
	cfg    config.Config
	client *http.Client
}

func (m *Meta) Name() string { return "meta" }
func (m *Meta) AuthorizationURL(state string) (string, error) {
	if m.cfg.MetaAppID == "" {
		return "", errors.New("Meta App ID is not configured")
	}
	if m.cfg.MetaLoginMode == "unified" {
		if m.cfg.MetaLoginConfigID == "" {
			return "", errors.New("Meta Unified Login configuration ID is not configured")
		}
		q := url.Values{
			"client_id":     {m.cfg.MetaAppID},
			"config_id":     {m.cfg.MetaLoginConfigID},
			"redirect_uri":  {m.cfg.MetaRedirectURI},
			"response_type": {"code"},
			"prompt":        {"login"},
			"state":         {state},
		}
		return "https://www.facebook.com/dialog/oauth?" + q.Encode(), nil
	}
	q := url.Values{"client_id": {m.cfg.MetaAppID}, "redirect_uri": {m.cfg.MetaRedirectURI}, "response_type": {"code"}, "state": {state}, "scope": {"instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages"}}
	return "https://www.instagram.com/oauth/authorize?" + q.Encode(), nil
}
func (m *Meta) ExchangeCode(ctx context.Context, code string) (Account, error) {
	if m.cfg.MetaLoginMode == "unified" {
		return m.exchangeUnifiedCode(ctx, code)
	}
	return m.exchangeInstagramCode(ctx, code)
}

func (m *Meta) exchangeInstagramCode(ctx context.Context, code string) (Account, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("client_id", m.cfg.MetaAppID)
	_ = writer.WriteField("client_secret", m.cfg.MetaAppSecret)
	_ = writer.WriteField("grant_type", "authorization_code")
	_ = writer.WriteField("redirect_uri", m.cfg.MetaRedirectURI)
	_ = writer.WriteField("code", code)
	_ = writer.Close()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.instagram.com/oauth/access_token", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	var token struct {
		AccessToken string      `json:"access_token"`
		UserID      json.Number `json:"user_id"`
		Permissions []string    `json:"permissions"`
	}
	if err := m.do(req, &token); err != nil {
		return Account{}, err
	}
	if token.AccessToken == "" {
		return Account{}, errors.New("Meta token exchange returned no token")
	}
	longURL := "https://graph.instagram.com/access_token?" + url.Values{"grant_type": {"ig_exchange_token"}, "client_secret": {m.cfg.MetaAppSecret}, "access_token": {token.AccessToken}}.Encode()
	longReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, longURL, nil)
	var long struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := m.do(longReq, &long); err == nil && long.AccessToken != "" {
		token.AccessToken = long.AccessToken
	}
	identityURL := "https://graph.instagram.com/" + m.cfg.MetaAPIVersion + "/me?" + url.Values{"fields": {"user_id,username,account_type,profile_picture_url"}, "access_token": {token.AccessToken}}.Encode()
	identityReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, identityURL, nil)
	var identity struct {
		ID                string `json:"id"`
		UserID            string `json:"user_id"`
		Username          string `json:"username"`
		AccountType       string `json:"account_type"`
		ProfilePictureURL string `json:"profile_picture_url"`
	}
	if err := m.do(identityReq, &identity); err != nil {
		return Account{}, err
	}
	if identity.UserID == "" {
		identity.UserID = identity.ID
	}
	var expiry *time.Time
	if long.ExpiresIn > 0 {
		value := time.Now().Add(time.Duration(long.ExpiresIn) * time.Second)
		expiry = &value
	}
	return Account{ID: identity.UserID, Username: identity.Username, AccountType: identity.AccountType, AvatarURL: identity.ProfilePictureURL, AccessToken: token.AccessToken, ExpiresAt: expiry, Scopes: token.Permissions}, nil
}

func (m *Meta) exchangeUnifiedCode(ctx context.Context, code string) (Account, error) {
	if strings.TrimSpace(code) == "" {
		return Account{}, errors.New("Meta authorization code is missing")
	}
	graphBase := "https://graph.facebook.com/" + m.cfg.MetaAPIVersion
	tokenURL := graphBase + "/oauth/access_token?" + url.Values{
		"client_id":     {m.cfg.MetaAppID},
		"client_secret": {m.cfg.MetaAppSecret},
		"redirect_uri":  {m.cfg.MetaRedirectURI},
		"code":          {code},
	}.Encode()
	tokenReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, tokenURL, nil)
	var token struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := m.do(tokenReq, &token); err != nil {
		return Account{}, err
	}
	if token.AccessToken == "" {
		return Account{}, errors.New("Meta Unified Login returned no token")
	}

	accounts, err := m.assignedInstagramAccounts(ctx, graphBase, token.AccessToken)
	if err != nil {
		return Account{}, err
	}
	if len(accounts) == 0 {
		return Account{}, errors.New("Meta Unified Login did not share an Instagram professional account")
	}
	if len(accounts) > 1 {
		return Account{}, errors.New("Meta Unified Login shared multiple Instagram accounts; reconnect and select exactly one account")
	}
	selected := accounts[0]
	if err = m.subscribeUnifiedWebhooks(ctx, graphBase, token.AccessToken, selected.ID); err != nil {
		return Account{}, err
	}
	scopes := m.unifiedGrantedPermissions(ctx, graphBase, token.AccessToken)
	var expiry *time.Time
	if token.ExpiresIn > 0 {
		value := time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
		expiry = &value
	}
	return Account{
		ID:          selected.ID,
		Username:    selected.Username,
		AccountType: "PROFESSIONAL",
		AvatarURL:   selected.ProfilePictureURL,
		AccessToken: token.AccessToken,
		ExpiresAt:   expiry,
		Scopes:      scopes,
	}, nil
}

// DisconnectAccount is best-effort cleanup invoked before local token removal.
// The HTTP handler still disconnects locally if Meta rejects an expired token.
func (m *Meta) DisconnectAccount(ctx context.Context, token, accountID string) error {
	host := "https://graph.instagram.com"
	if m.cfg.MetaLoginMode == "unified" {
		host = "https://graph.facebook.com"
		if err := m.deleteGraphResource(ctx, host+"/"+m.cfg.MetaAPIVersion+"/"+url.PathEscape(accountID)+"/subscribed_apps", token); err != nil {
			return fmt.Errorf("Meta webhook unsubscribe failed: %w", err)
		}
	}
	if err := m.deleteGraphResource(ctx, host+"/"+m.cfg.MetaAPIVersion+"/me/permissions", token); err != nil {
		return fmt.Errorf("Meta permission revoke failed: %w", err)
	}
	return nil
}

func (m *Meta) deleteGraphResource(ctx context.Context, endpoint, token string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	var response struct {
		Success bool `json:"success"`
	}
	if err := m.do(req, &response); err != nil {
		return err
	}
	if !response.Success {
		return errors.New("Meta did not confirm the operation")
	}
	return nil
}

func (m *Meta) ListMedia(ctx context.Context, token, accountID string) ([]Media, error) {
	if strings.TrimSpace(token) == "" || strings.TrimSpace(accountID) == "" {
		return nil, errors.New("Instagram account authorization is missing")
	}
	host := "https://graph.instagram.com"
	if m.cfg.MetaLoginMode == "unified" {
		host = "https://graph.facebook.com"
	}
	query := url.Values{
		"fields": {"id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp"},
		"limit":  {"50"},
	}
	endpoint := fmt.Sprintf("%s/%s/%s/media?%s", host, m.cfg.MetaAPIVersion, url.PathEscape(accountID), query.Encode())
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	var response struct {
		Data []Media `json:"data"`
	}
	if err := m.do(req, &response); err != nil {
		return nil, err
	}
	items := make([]Media, 0, len(response.Data))
	for _, item := range response.Data {
		if strings.TrimSpace(item.ID) == "" {
			continue
		}
		item.MediaURL = safeProviderURL(item.MediaURL)
		item.ThumbnailURL = safeProviderURL(item.ThumbnailURL)
		item.Permalink = safeProviderURL(item.Permalink)
		items = append(items, item)
	}
	return items, nil
}

func safeProviderURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return ""
	}
	return parsed.String()
}

type unifiedInstagramAccount struct {
	ID                string `json:"id"`
	Username          string `json:"username"`
	ProfilePictureURL string `json:"profile_picture_url"`
}

func (m *Meta) assignedInstagramAccounts(ctx context.Context, graphBase, token string) ([]unifiedInstagramAccount, error) {
	items := []unifiedInstagramAccount{}
	seenAccounts := map[string]bool{}
	seenCursors := map[string]bool{}
	after := ""
	for pageNumber := 0; pageNumber < 100; pageNumber++ {
		query := url.Values{"fields": {"id,username,profile_picture_url"}, "limit": {"100"}}
		if after != "" {
			query.Set("after", after)
		}
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, graphBase+"/me/assigned_instagram_accounts?"+query.Encode(), nil)
		req.Header.Set("Authorization", "Bearer "+token)
		var response struct {
			Data   []unifiedInstagramAccount `json:"data"`
			Paging struct {
				Cursors struct {
					After string `json:"after"`
				} `json:"cursors"`
			} `json:"paging"`
		}
		if err := m.do(req, &response); err != nil {
			return nil, err
		}
		for _, account := range response.Data {
			if account.ID == "" || seenAccounts[account.ID] {
				continue
			}
			seenAccounts[account.ID] = true
			items = append(items, account)
		}
		next := response.Paging.Cursors.After
		if len(response.Data) == 0 || next == "" || next == after {
			return items, nil
		}
		if seenCursors[next] {
			return nil, errors.New("Meta account discovery returned a repeated cursor")
		}
		seenCursors[next] = true
		after = next
	}
	return nil, errors.New("Meta account discovery exceeded the pagination safety limit")
}

func (m *Meta) unifiedGrantedPermissions(ctx context.Context, graphBase, token string) []string {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, graphBase+"/me/permissions", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	var response struct {
		Data []struct {
			Permission string `json:"permission"`
			Status     string `json:"status"`
		} `json:"data"`
	}
	if err := m.do(req, &response); err != nil {
		return []string{}
	}
	permissions := []string{}
	for _, item := range response.Data {
		if item.Status == "granted" && item.Permission != "" {
			permissions = append(permissions, item.Permission)
		}
	}
	return permissions
}

func (m *Meta) subscribeUnifiedWebhooks(ctx context.Context, graphBase, token, accountID string) error {
	form := url.Values{"subscribed_fields": {"messages,comments,messaging_postbacks"}}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, graphBase+"/"+url.PathEscape(accountID)+"/subscribed_apps", strings.NewReader(form.Encode()))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var response struct {
		Success bool `json:"success"`
	}
	if err := m.do(req, &response); err != nil {
		return fmt.Errorf("Meta webhook subscription failed: %w", err)
	}
	if !response.Success {
		return errors.New("Meta webhook subscription was not confirmed")
	}
	return nil
}
func (m *Meta) SendPrivateReply(ctx context.Context, token, accountID, commentID, text string) (Delivery, error) {
	return m.send(ctx, token, accountID, map[string]any{"recipient": map[string]string{"comment_id": commentID}, "message": map[string]string{"text": text}})
}
func (m *Meta) CheckFollowerStatus(ctx context.Context, token, participantID string, scopes []string) (domain.FollowerStatus, error) {
	// Meta documents is_user_follow_business on the Instagram Login messaging
	// user-profile surface. Unified/Facebook Login and a comment by itself do
	// not prove that this profile lookup is available.
	if m.cfg.MetaLoginMode != "instagram" {
		return domain.FollowerUnknown, errors.New("follow verification is unavailable for the configured login mode")
	}
	if !containsScope(scopes, "instagram_business_manage_messages") {
		return domain.FollowerUnknown, errors.New("follow verification requires instagram_business_manage_messages")
	}
	if strings.TrimSpace(participantID) == "" {
		return domain.FollowerUnknown, errors.New("comment event did not include a participant ID")
	}
	endpoint := "https://graph.instagram.com/" + m.cfg.MetaAPIVersion + "/" + url.PathEscape(participantID) + "?" + url.Values{"fields": {"is_user_follow_business"}}.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	var result struct {
		IsUserFollowBusiness *bool `json:"is_user_follow_business"`
	}
	if err := m.do(req, &result); err != nil {
		return domain.FollowerUnknown, err
	}
	if result.IsUserFollowBusiness == nil {
		return domain.FollowerUnknown, errors.New("Meta user profile did not return follow status")
	}
	if *result.IsUserFollowBusiness {
		return domain.Follower, nil
	}
	return domain.NotFollower, nil
}
func (m *Meta) SendPublicCommentReply(ctx context.Context, token, commentID, text string) (Delivery, error) {
	host := "https://graph.instagram.com"
	if m.cfg.MetaLoginMode == "unified" {
		host = "https://graph.facebook.com"
	}
	form := url.Values{"message": {text}}
	endpoint := fmt.Sprintf("%s/%s/%s/replies", host, m.cfg.MetaAPIVersion, url.PathEscape(commentID))
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var result struct {
		ID string `json:"id"`
	}
	if err := m.do(req, &result); err != nil {
		return Delivery{}, err
	}
	if result.ID == "" {
		return Delivery{}, errors.New("Meta public comment reply returned no ID")
	}
	return Delivery{MessageID: result.ID}, nil
}
func (m *Meta) SendMessage(ctx context.Context, token, accountID, participantID, text string) (Delivery, error) {
	return m.send(ctx, token, accountID, map[string]any{"recipient": map[string]string{"id": participantID}, "message": map[string]string{"text": text}})
}
func (m *Meta) send(ctx context.Context, token, accountID string, payload map[string]any) (Delivery, error) {
	raw, _ := json.Marshal(payload)
	host := "https://graph.instagram.com"
	if m.cfg.MetaLoginMode == "unified" {
		host = "https://graph.facebook.com"
	}
	endpoint := fmt.Sprintf("%s/%s/%s/messages", host, m.cfg.MetaAPIVersion, url.PathEscape(accountID))
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	var result struct {
		MessageID   string `json:"message_id"`
		RecipientID string `json:"recipient_id"`
	}
	if err := m.do(req, &result); err != nil {
		return Delivery{}, err
	}
	if result.MessageID == "" {
		return Delivery{}, errors.New("Meta delivery returned no message ID")
	}
	return Delivery{MessageID: result.MessageID}, nil
}
func (m *Meta) VerifyWebhook(body []byte, signature string) bool {
	if m.cfg.WebhookAppSecret == "" || !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	expected, err := hex.DecodeString(strings.TrimPrefix(signature, "sha256="))
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(m.cfg.WebhookAppSecret))
	mac.Write(body)
	return hmac.Equal(expected, mac.Sum(nil))
}
func (m *Meta) ParseWebhook(body []byte) ([]domain.ProviderEvent, error) { return parseEvents(body) }
func (m *Meta) do(req *http.Request, dest any) error {
	res, err := m.client.Do(req)
	if err != nil {
		return &APIError{Ambiguous: req.Method != http.MethodGet}
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var apiErr struct {
			Error struct {
				Message, Type string
				Code          int
			}
		}
		_ = json.Unmarshal(data, &apiErr)
		return &APIError{StatusCode: res.StatusCode, Code: apiErr.Error.Code, Type: apiErr.Error.Type, Retryable: res.StatusCode == http.StatusTooManyRequests}
	}
	if err = json.Unmarshal(data, dest); err != nil {
		return errors.New("invalid response from Meta")
	}
	return nil
}

func containsScope(scopes []string, target string) bool {
	for _, scope := range scopes {
		if scope == target {
			return true
		}
	}
	return false
}

func parseEvents(body []byte) ([]domain.ProviderEvent, error) {
	type webhookFrom struct {
		ID       string `json:"id"`
		Username string `json:"username"`
	}
	type webhookValue struct {
		ID      string `json:"id"`
		Text    string `json:"text"`
		MediaID string `json:"media_id"`
		Media   struct {
			ID string `json:"id"`
		} `json:"media"`
		From webhookFrom `json:"from"`
	}
	type webhookChange struct {
		Field string       `json:"field"`
		Value webhookValue `json:"value"`
	}
	var payload struct {
		Entry []struct {
			ID        string          `json:"id"`
			Time      int64           `json:"time"`
			Changes   []webhookChange `json:"changes"`
			Messaging []struct {
				Sender struct {
					ID string `json:"id"`
				} `json:"sender"`
				Recipient struct {
					ID string `json:"id"`
				} `json:"recipient"`
				Timestamp int64 `json:"timestamp"`
				Message   struct {
					MID    string `json:"mid"`
					Text   string `json:"text"`
					IsEcho bool   `json:"is_echo"`
				} `json:"message"`
			} `json:"messaging"`
		} `json:"entry"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, errors.New("invalid webhook JSON")
	}
	events := []domain.ProviderEvent{}
	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			if change.Field != "comments" && change.Field != "comment" {
				continue
			}
			if entry.ID == "" || change.Value.ID == "" || change.Value.From.ID == "" || strings.TrimSpace(change.Value.Text) == "" {
				continue
			}
			mediaID := change.Value.MediaID
			if mediaID == "" {
				mediaID = change.Value.Media.ID
			}
			created := time.Unix(entry.Time, 0)
			if entry.Time == 0 {
				created = time.Now()
			}
			comment := domain.CommentEvent{ProviderEventID: "comment:" + change.Value.ID, AccountID: entry.ID, CommentID: change.Value.ID, MediaID: mediaID, Text: change.Value.Text, Username: change.Value.From.Username, ParticipantID: change.Value.From.ID, CreatedAt: created, RawRedacted: json.RawMessage(`{"redacted":true}`)}
			events = append(events, domain.ProviderEvent{Type: domain.ProviderEventComment, Comment: &comment})
		}
		for _, messaging := range entry.Messaging {
			// Echoes are outbound messages mirrored by Meta and must never open
			// the participant reply window.
			if messaging.Message.IsEcho || messaging.Message.MID == "" || messaging.Sender.ID == "" || strings.TrimSpace(messaging.Message.Text) == "" {
				continue
			}
			accountID := messaging.Recipient.ID
			if accountID == "" {
				accountID = entry.ID
			}
			if accountID == "" || messaging.Sender.ID == accountID {
				continue
			}
			created := time.UnixMilli(messaging.Timestamp)
			if messaging.Timestamp == 0 {
				created = time.Now()
			}
			message := domain.InboundMessageEvent{
				ProviderEventID:   "message:" + messaging.Message.MID,
				AccountID:         accountID,
				ProviderMessageID: messaging.Message.MID,
				ParticipantID:     messaging.Sender.ID,
				Text:              messaging.Message.Text,
				CreatedAt:         created,
				RawRedacted:       json.RawMessage(`{"redacted":true}`),
			}
			events = append(events, domain.ProviderEvent{Type: domain.ProviderEventInboundMessage, Message: &message})
		}
	}
	return events, nil
}
func shortID(value string) string {
	sum := sha256.Sum256([]byte(value + time.Now().UTC().Format(time.RFC3339Nano)))
	return hex.EncodeToString(sum[:6])
}
