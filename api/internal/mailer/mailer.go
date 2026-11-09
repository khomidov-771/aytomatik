package mailer

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/config"
)

type Mailer interface {
	Send(ctx context.Context, to, subject, text string) error
}

func New(cfg config.Config) Mailer {
	if cfg.MailProvider == "smtp" {
		return &SMTP{
			from: cfg.MailFrom, host: cfg.SMTPHost, port: cfg.SMTPPort,
			user: cfg.SMTPUser, password: cfg.SMTPPassword, startTLS: cfg.SMTPStartTLS,
		}
	}
	return Log{}
}

// Log is an explicit development adapter. It never claims to deliver email.
type Log struct{}

func (Log) Send(_ context.Context, to, subject, _ string) error {
	// Message bodies contain verification, reset and invitation tokens. They
	// must never be written to logs, including in local development.
	slog.Info("development mail suppressed", "delivered", false, "to", to, "subject", subject)
	return nil
}

type SMTP struct {
	from, host, port, user, password string
	startTLS                         bool
}

func (s *SMTP) Send(ctx context.Context, to, subject, text string) error {
	from, err := mail.ParseAddress(s.from)
	if err != nil {
		return fmt.Errorf("invalid MAIL_FROM: %w", err)
	}
	recipient, err := mail.ParseAddress(to)
	if err != nil {
		return fmt.Errorf("invalid recipient: %w", err)
	}
	address := net.JoinHostPort(s.host, s.port)
	dialer := net.Dialer{Timeout: 10 * time.Second}
	connection, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("SMTP dial failed: %w", err)
	}
	defer connection.Close()
	deadline := time.Now().Add(15 * time.Second)
	if contextDeadline, ok := ctx.Deadline(); ok && contextDeadline.Before(deadline) {
		deadline = contextDeadline
	}
	if err = connection.SetDeadline(deadline); err != nil {
		return fmt.Errorf("SMTP deadline failed: %w", err)
	}
	client, err := smtp.NewClient(connection, s.host)
	if err != nil {
		return fmt.Errorf("SMTP handshake failed: %w", err)
	}
	defer client.Close()
	if s.startTLS {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return fmt.Errorf("SMTP server does not support STARTTLS")
		}
		if err = client.StartTLS(&tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("SMTP STARTTLS failed: %w", err)
		}
	}
	if s.user != "" {
		if err = client.Auth(smtp.PlainAuth("", s.user, s.password, s.host)); err != nil {
			return fmt.Errorf("SMTP authentication failed: %w", err)
		}
	}
	if err = client.Mail(from.Address); err != nil {
		return fmt.Errorf("SMTP sender rejected: %w", err)
	}
	if err = client.Rcpt(recipient.Address); err != nil {
		return fmt.Errorf("SMTP recipient rejected: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA failed: %w", err)
	}
	message := strings.Join([]string{
		"From: " + from.String(), "To: " + recipient.String(), "Subject: " + subject,
		"MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", text,
	}, "\r\n")
	if _, err = io.WriteString(w, message); err != nil {
		_ = w.Close()
		return fmt.Errorf("SMTP write failed: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("SMTP delivery failed: %w", err)
	}
	return client.Quit()
}
