package config

import (
	"encoding/base64"
	"errors"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"time"
)

type Config struct {
	Env                string
	Port               string
	AppURL             string
	APIURL             string
	DatabaseURL        string
	RedisURL           string
	SessionSecret      string
	EncryptionKey      []byte
	CookieSecure       bool
	AllowedOrigins     []string
	InstagramProvider  string
	MetaAppID          string
	MetaAppSecret      string
	MetaAPIVersion     string
	MetaLoginMode      string
	MetaLoginConfigID  string
	MetaRedirectURI    string
	WebhookVerifyToken string
	WebhookAppSecret   string
	MailProvider       string
	MailFrom           string
	SMTPHost           string
	SMTPPort           string
	SMTPUser           string
	SMTPPassword       string
	SMTPStartTLS       bool
	TrustedProxyCIDRs  []string
	ShortSessionTTL    time.Duration
	SessionTTL         time.Duration
}

func Load() (Config, error) {
	appEnv := env("APP_ENV", "development")
	metaLoginConfigID := strings.TrimSpace(os.Getenv("META_LOGIN_CONFIG_ID"))
	metaLoginMode := env("META_LOGIN_MODE", "instagram")
	if metaLoginConfigID != "" && os.Getenv("META_LOGIN_MODE") == "" {
		metaLoginMode = "unified"
	}
	c := Config{
		Env:                appEnv,
		Port:               env("PORT", "8080"),
		AppURL:             env("APP_URL", "http://localhost:3000"),
		APIURL:             env("API_URL", "http://localhost:8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		RedisURL:           os.Getenv("REDIS_URL"),
		SessionSecret:      os.Getenv("SESSION_SECRET"),
		CookieSecure:       env("COOKIE_SECURE", "false") == "true",
		AllowedOrigins:     split(env("ALLOWED_ORIGINS", "http://localhost:3000")),
		InstagramProvider:  env("INSTAGRAM_PROVIDER", "meta"),
		MetaAppID:          os.Getenv("META_APP_ID"),
		MetaAppSecret:      os.Getenv("META_APP_SECRET"),
		MetaAPIVersion:     env("META_API_VERSION", "v25.0"),
		MetaLoginMode:      metaLoginMode,
		MetaLoginConfigID:  metaLoginConfigID,
		MetaRedirectURI:    env("META_REDIRECT_URI", "http://localhost:8080/api/v1/instagram/callback"),
		WebhookVerifyToken: os.Getenv("META_WEBHOOK_VERIFY_TOKEN"),
		WebhookAppSecret:   os.Getenv("META_WEBHOOK_APP_SECRET"),
		MailProvider:       env("MAIL_PROVIDER", "log"),
		MailFrom:           env("MAIL_FROM", "IDS Automate <noreply@localhost>"),
		SMTPHost:           os.Getenv("MAIL_SMTP_HOST"),
		SMTPPort:           env("MAIL_SMTP_PORT", "587"),
		SMTPUser:           os.Getenv("MAIL_SMTP_USER"),
		SMTPPassword:       os.Getenv("MAIL_SMTP_PASSWORD"),
		SMTPStartTLS:       env("MAIL_SMTP_STARTTLS", "true") == "true",
		TrustedProxyCIDRs:  split(env("TRUSTED_PROXY_CIDRS", "127.0.0.1/32,::1/128,172.16.0.0/12")),
		ShortSessionTTL:    24 * time.Hour,
		SessionTTL:         30 * 24 * time.Hour,
	}
	if c.DatabaseURL == "" {
		return c, errors.New("DATABASE_URL is required")
	}
	key, err := base64.StdEncoding.DecodeString(os.Getenv("TOKEN_ENCRYPTION_KEY"))
	if err != nil || len(key) != 32 {
		if c.Env == "production" {
			return c, errors.New("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key")
		}
		// Deterministic development-only key. Production refuses to start with it.
		key = []byte("ids-automate-dev-key-32-bytes!!!")
	}
	c.EncryptionKey = key
	if c.Env == "production" && len(c.SessionSecret) < 32 {
		return c, errors.New("SESSION_SECRET must contain at least 32 characters")
	}
	if c.InstagramProvider != "mock" && c.InstagramProvider != "meta" {
		return c, errors.New("INSTAGRAM_PROVIDER must be mock or meta")
	}
	if c.InstagramProvider == "mock" && c.Env != "test" {
		return c, errors.New("mock Instagram provider is test-only")
	}
	if c.Env == "production" && c.InstagramProvider == "meta" && (c.MetaAppID == "" || c.MetaAppSecret == "" || c.WebhookVerifyToken == "" || c.WebhookAppSecret == "") {
		return c, errors.New("meta provider requires app ID, app secret and webhook secrets")
	}
	if c.MetaLoginMode != "instagram" && c.MetaLoginMode != "unified" {
		return c, errors.New("META_LOGIN_MODE must be instagram or unified")
	}
	if c.Env == "production" && c.InstagramProvider == "meta" && c.MetaLoginMode == "unified" && c.MetaLoginConfigID == "" {
		return c, errors.New("unified Meta login requires META_LOGIN_CONFIG_ID")
	}
	if c.MailProvider != "log" && c.MailProvider != "smtp" {
		return c, errors.New("MAIL_PROVIDER must be log or smtp")
	}
	if c.MailProvider == "smtp" && (c.SMTPHost == "" || c.MailFrom == "") {
		return c, errors.New("smtp mail provider requires MAIL_SMTP_HOST and MAIL_FROM")
	}
	if c.Env == "production" && c.MailProvider != "smtp" {
		return c, errors.New("production requires MAIL_PROVIDER=smtp")
	}
	if c.Env == "production" && !c.SMTPStartTLS {
		return c, errors.New("production SMTP requires STARTTLS")
	}
	if c.Env == "production" {
		if !c.CookieSecure {
			return c, errors.New("production requires COOKIE_SECURE=true")
		}
		if !isHTTPSURL(c.AppURL) || !isHTTPSURL(c.APIURL) {
			return c, errors.New("production APP_URL and API_URL must be absolute HTTPS URLs")
		}
		if len(c.AllowedOrigins) == 0 {
			return c, errors.New("production requires at least one HTTPS ALLOWED_ORIGINS value")
		}
		for _, origin := range c.AllowedOrigins {
			parsed, parseErr := url.Parse(origin)
			if parseErr != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
				return c, errors.New("production ALLOWED_ORIGINS must contain HTTPS origins without paths")
			}
		}
		if c.InstagramProvider == "meta" && !isHTTPSURL(c.MetaRedirectURI) {
			return c, errors.New("production Meta redirect URI must be an absolute HTTPS URL")
		}
	}
	for _, value := range c.TrustedProxyCIDRs {
		if _, err := netip.ParsePrefix(value); err != nil {
			return c, errors.New("TRUSTED_PROXY_CIDRS contains an invalid network")
		}
	}
	return c, nil
}

func isHTTPSURL(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil && parsed.Scheme == "https" && parsed.Host != ""
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func split(value string) []string {
	parts := strings.Split(value, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}
