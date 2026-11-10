package config

import (
	"encoding/base64"
	"strings"
	"testing"
)

func baseEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://test/test")
	t.Setenv("APP_ENV", "test")
	t.Setenv("INSTAGRAM_PROVIDER", "mock")
	t.Setenv("MAIL_PROVIDER", "log")
	t.Setenv("TOKEN_ENCRYPTION_KEY", "")
}

func validProductionEnv(t *testing.T) {
	t.Helper()
	baseEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("APP_URL", "https://automate.example.com")
	t.Setenv("API_URL", "https://automate.example.com")
	t.Setenv("ALLOWED_ORIGINS", "https://automate.example.com")
	t.Setenv("COOKIE_SECURE", "true")
	t.Setenv("SESSION_SECRET", strings.Repeat("s", 32))
	t.Setenv("TOKEN_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32))))
	t.Setenv("MAIL_PROVIDER", "smtp")
	t.Setenv("MAIL_FROM", "IDS <noreply@example.com>")
	t.Setenv("MAIL_SMTP_HOST", "smtp.example.com")
	t.Setenv("MAIL_SMTP_STARTTLS", "true")
	setMetaEnv(t)
}

func setMetaEnv(t *testing.T) {
	t.Helper()
	t.Setenv("INSTAGRAM_PROVIDER", "meta")
	t.Setenv("META_APP_ID", "1234567890123456")
	t.Setenv("META_APP_SECRET", strings.Repeat("a", 32))
	t.Setenv("META_WEBHOOK_VERIFY_TOKEN", strings.Repeat("v", 32))
	t.Setenv("META_WEBHOOK_APP_SECRET", strings.Repeat("a", 32))
	t.Setenv("META_LOGIN_MODE", "unified")
	t.Setenv("META_LOGIN_CONFIG_ID", "2331645327602552")
}

func TestDevelopmentAllowsExplicitLogMailer(t *testing.T) {
	baseEnv(t)
	cfg, err := Load()
	if err != nil {
		t.Fatalf("development config rejected: %v", err)
	}
	if cfg.MailProvider != "log" || len(cfg.EncryptionKey) != 32 {
		t.Fatalf("unexpected development config: %#v", cfg)
	}
}

func TestProductionRequiresSecureSMTP(t *testing.T) {
	baseEnv(t)
	t.Setenv("APP_ENV", "production")
	setMetaEnv(t)
	t.Setenv("SESSION_SECRET", strings.Repeat("s", 32))
	t.Setenv("TOKEN_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32))))
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "MAIL_PROVIDER=smtp") {
		t.Fatalf("production log mailer must be rejected, got %v", err)
	}
	t.Setenv("MAIL_PROVIDER", "smtp")
	t.Setenv("MAIL_FROM", "IDS <noreply@example.com>")
	t.Setenv("MAIL_SMTP_HOST", "smtp.example.com")
	t.Setenv("MAIL_SMTP_STARTTLS", "false")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "STARTTLS") {
		t.Fatalf("production plaintext SMTP must be rejected, got %v", err)
	}
}

func TestMockProviderIsTestOnly(t *testing.T) {
	baseEnv(t)
	t.Setenv("APP_ENV", "development")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "test-only") {
		t.Fatalf("development mock provider must be rejected, got %v", err)
	}
}

func TestDevelopmentCanRunWithMetaIntegrationUnconfigured(t *testing.T) {
	baseEnv(t)
	t.Setenv("APP_ENV", "development")
	t.Setenv("INSTAGRAM_PROVIDER", "meta")
	t.Setenv("META_APP_ID", "")
	t.Setenv("META_APP_SECRET", "")
	t.Setenv("META_WEBHOOK_VERIFY_TOKEN", "")
	t.Setenv("META_WEBHOOK_APP_SECRET", "")
	t.Setenv("META_LOGIN_MODE", "unified")
	t.Setenv("META_LOGIN_CONFIG_ID", "")
	if _, err := Load(); err != nil {
		t.Fatalf("development UI should run while Meta integration stays blocked: %v", err)
	}
}

func TestProductionRequiresSecurePublicURLsAndCookie(t *testing.T) {
	validProductionEnv(t)
	t.Setenv("COOKIE_SECURE", "false")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "COOKIE_SECURE") {
		t.Fatalf("production insecure cookie must be rejected, got %v", err)
	}

	t.Setenv("COOKIE_SECURE", "true")
	t.Setenv("APP_URL", "http://automate.example.com")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("production HTTP public URL must be rejected, got %v", err)
	}

	t.Setenv("APP_URL", "https://automate.example.com")
	t.Setenv("ALLOWED_ORIGINS", "https://automate.example.com/path")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "ALLOWED_ORIGINS") {
		t.Fatalf("production origin with path must be rejected, got %v", err)
	}
}

func TestUnifiedMetaRequiresConfigurationID(t *testing.T) {
	validProductionEnv(t)
	t.Setenv("META_LOGIN_MODE", "unified")
	t.Setenv("META_LOGIN_CONFIG_ID", "")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "META_LOGIN_CONFIG_ID") {
		t.Fatalf("unified login without configuration id must be rejected, got %v", err)
	}
}

func TestMetaConfigurationReadyRejectsPlaceholders(t *testing.T) {
	cfg := Config{
		InstagramProvider:  "meta",
		MetaAppID:          "1234567890123456",
		MetaAppSecret:      "app-secret",
		MetaLoginMode:      "unified",
		MetaLoginConfigID:  "2331645327602552",
		WebhookVerifyToken: strings.Repeat("v", 32),
		WebhookAppSecret:   "app-secret",
	}
	if cfg.MetaConfigurationReady() {
		t.Fatal("placeholder Meta secrets must not be reported as configured")
	}
	cfg.MetaAppSecret = strings.Repeat("a", 32)
	cfg.WebhookAppSecret = strings.Repeat("a", 32)
	if !cfg.MetaConfigurationReady() {
		t.Fatal("plausible Meta production configuration should be ready for live OAuth verification")
	}
	cfg.MetaLoginConfigID = "config-id"
	if cfg.MetaConfigurationReady() {
		t.Fatal("non-numeric Unified Login configuration ID must be rejected")
	}
}
