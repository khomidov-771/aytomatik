# IDS Automate next steps

Current-revision local unit/build/PostgreSQL/Mock E2E gates pass. Remaining tasks require external credentials/infrastructure, a Docker host or explicit product/legal decisions. Do not rewrite green flows or call simulations live Meta evidence.

## P0 — release blockers

### P0.1 Live Meta Unified Login acceptance

Prerequisites:

- Meta App ID/App Secret for the app owning Configuration ID `2331645327602552`;
- approved test business/user and exactly one Instagram Business or Creator account;
- HTTPS OAuth and webhook domain;
- required review/access.

Files to change only if live evidence exposes a defect:

- `api/internal/provider/provider.go`
- `api/internal/httpapi/instagram.go`
- provider fixtures/tests
- `docs/META_SETUP_CHECKLIST.md`

Procedure:

1. Match `META_REDIRECT_URI` character-for-character in Meta.
2. Complete consent with exactly one Professional asset.
3. Confirm code exchange, expiry metadata, account discovery and `subscribed_apps` without logging secrets.
4. Capture sanitized signed comment/message fixtures.
5. Prove invalid signature rejection and duplicate event idempotency.
6. Prove one policy-eligible private reply and one inbound/manual DM flow.
7. Record denied permission, expired/revoked token and rate-limit behavior.

Pass condition: real delivery IDs and live signed webhook evidence are recorded; Mock or controlled HTTP tests do not satisfy this gate.

### P0.2 Docker Compose runtime

Current blocker: no `docker` executable on this workstation.

On an authorized Docker host:

```powershell
docker version
docker compose version
docker compose config
docker compose up --build -d
docker compose ps
docker compose exec api /ids-seed
```

Files: `docker-compose.yml`, `docker-compose.prod.yml`, both Dockerfiles and Nginx template. Verify health checks, migration startup, Redis failure fallback and that production PostgreSQL/Redis have no public ports.

Pass condition: both images build, services become healthy, local Mock critical flow passes against containers and `docker compose down` preserves named data volumes. Never use `down -v` on production.

### P0.3 Real SMTP

Configure a real STARTTLS provider and verify registration, password reset and invitation delivery plus bad credentials, TLS hostname failure and timeout. Files should change only if an observed failure exists: `api/internal/mailer/mailer.go`, `api/internal/config/config.go` and server-only `.env.production`.

Pass condition: all three emails arrive with correct HTTPS links and no token/message body appears in production logs or API responses.

### P0.4 Staging/VPS, HTTPS and recovery

Follow `docs/DEPLOYMENT.md` on an explicitly authorized target. Verify certificate issue/renewal, secure cookies, public callback URLs, restart behavior, logs, monitoring and an encrypted PostgreSQL backup restored into an isolated database.

Pass condition: only 80/443 are public, health checks remain green after restart, renewal succeeds and a timed restore drill is documented.

### P0.5 Responsive/accessibility matrix

Extend Playwright for 360, 768 and 1440 widths, keyboard/focus behavior, reduced motion and an accessibility scanner. Likely files: `web/e2e/`, `web/app/globals.css` and only pages with reproduced failures.

Pass condition: Chromium plus a second browser engine pass with no critical accessibility findings.

## P1 — security/tooling follow-up

Monitor the upstream ESLint/TypeScript-ESLint dependency tree for a non-breaking patched `minimatch`. Production audit is currently clean; full audit has eight moderate dev-only findings. Do not apply npm’s proposed breaking `--force` downgrade without separately proving lint/build compatibility.

If available on a network-enabled machine, run `govulncheck ./...` and record exact output in `docs/TEST_REPORT.md`.

## P1 — product/legal decisions

### Data deletion/export

Current behavior records `pending_manual_review`. Before irreversible code, owner/legal must define identity verification, grace period, billing/audit retention, token revocation, export format, message/comment PII handling and backup expiry. Then add a queued privacy workflow, migration, audit evidence and integration/E2E tests.

### Payment provider

Production billing intentionally uses `BILLING_MODE=disabled`. Select a provider and define currency, invoices/tax, webhook states, dunning, refunds, proration and limit transitions before implementing it.

### Delivery reconciliation

Keep `delivery_state_unknown` fail-closed. Add reconciliation only if the approved Meta API exposes a reliable delivery lookup; never blindly resend an ambiguous provider call.

## P2 — optional scope

- Standalone campaign lifecycle after explicit requirements.
- Tenant-safe streaming CSV export with audit entry.
- Notification center beyond the current settings link.
- Complete RU/EN localization.
- Multi-asset selection UI if the product later requires several assets per OAuth grant; current flow intentionally requires exactly one.

## First task for the next agent

Read `AGENTS.md`, the project skill, `docs/AI_HANDOFF.md` and `docs/TEST_REPORT.md`. Confirm which external prerequisite is now available. If Meta credentials are available, start with P0.1. If Docker is available, start with P0.2. Do not modify working application code before reproducing a current failure.
