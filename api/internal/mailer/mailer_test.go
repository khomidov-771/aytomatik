package mailer

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
)

func TestLogMailerNeverLogsBody(t *testing.T) {
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	secret := "reset-token-that-must-not-appear"
	if err := (Log{}).Send(context.Background(), "user@example.com", "Reset", secret); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(output.String(), secret) {
		t.Fatalf("mail body leaked to logs: %s", output.String())
	}
}
