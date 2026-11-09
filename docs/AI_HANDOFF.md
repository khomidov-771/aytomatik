# AI handoff — IDS Automate

## Start here

Repository: `C:\Users\secre\Desktop\1\IDS_Automate_Codex_Pack`.

Read completely, in this order:

1. `AGENTS.md`
2. `.codex/skills/ids-automate/SKILL.md`
3. `docs/TECHNICAL_SPEC.md`
4. `docs/DESIGN_GUIDE.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PROJECT_STATUS.md`
7. `docs/TEST_REPORT.md`
8. `docs/NEXT_STEPS.md`
9. this file

The audited directory has no confirmed Git metadata. Preserve working files, do not assume reset/checkout is available, and do not overwrite architecture merely to simplify a task.

## Current user instruction

The user explicitly authorized current-revision builds, OAuth/token/webhook/DM checks, PostgreSQL integration and documentation updates. Those local gates were run and are recorded in `docs/TEST_REPORT.md`. Live Meta must still be labeled blocked without credentials and approval.

## Product truth

IDS Automate is a full-stack multi-tenant Instagram automation SaaS, not a frontend mock. It includes auth, workspaces, RBAC, account connection, signed webhooks, durable automation jobs, Inbox, analytics, audit, plan limits and production infrastructure.

Mock Mode is a local product simulation and is visibly marked demo. It never means a message reached Instagram. Real Meta integration is implemented at code level but is not live-verified without app credentials, a permitted Professional account and the applicable Meta review/access.

## Supplied Meta information

The user supplied a Meta screen showing:

- `Instagram API (Unified Login)`
- `Instagram Login Compatible`
- Configuration ID `2331645327602552`

This ID is public OAuth configuration metadata, not an App Secret. It is included in `.env.example` as `META_LOGIN_CONFIG_ID`. Never ask the user to treat it as a secret, and never confuse it with `META_APP_ID` or `META_APP_SECRET`.

## What has been implemented

### Authentication, tenancy and security

- Unverified registration, one-time verification/reset tokens and verified-only login.
- Bcrypt cost 12 passwords; opaque hashed server sessions in HttpOnly cookies.
- Real remember-me TTL; expiry is preserved across workspace switch.
- CSRF on protected writes, same-origin/CORS policy and trusted-proxy-aware rate limiting.
- Workspace list/switch with membership check and session/CSRF rotation.
- Role order `customer < operator < manager < owner` and tenant-bound store calls.
- AES-256-GCM provider token encryption; token ciphertext never enters API DTOs.
- SMTP STARTTLS/TLS 1.2+ production gate; development mailer does not log token-bearing message bodies.
- Plain normalized email validation rejects display-name forms.
- Production requires secure cookies and absolute HTTPS app/API/origin/Meta redirect configuration.
- Bcrypt input is bounded at its 72-byte safety limit; JSON bodies reject trailing values.

### Meta and Mock providers

- Provider interface keeps Mock Mode and real Meta behavior separate.
- Legacy direct Instagram Login remains available with `META_LOGIN_MODE=instagram`.
- New `META_LOGIN_MODE=unified` builds Facebook Login for Business OAuth with `config_id` and no invented query scopes.
- Unified callback exchanges the code on versioned Facebook Graph.
- Assigned Instagram Professional accounts are cursor-paginated with dedupe, repeated-cursor and 100-page safety guards.
- Zero assets and multiple assets fail closed; the server never silently selects the first account.
- The selected account must confirm `subscribed_apps` for `messages,comments,messaging_postbacks` before persistence.
- Unified delivery uses `graph.facebook.com`; legacy mode retains its existing Graph host.
- OAuth state is short-lived, single-use and bound to user/workspace.
- Accounts/settings UI reports Meta Unified Login mode and callback failures.
- Disconnect attempts webhook unsubscribe/permission revoke before clearing the local encrypted token; expired-token cleanup failure never prevents safe local disconnect.

### Webhooks, automation and delivery

- Signed Meta webhook verification and normalized comment/inbound-message events.
- Persistence failure returns retryable HTTP 503 instead of incorrectly acknowledging and losing the webhook.
- Echo/self messages ignored; raw payload is not persisted.
- Active account routing is deterministic by provider + external account ID.
- PostgreSQL event rows are the durable queue; Redis only accelerates wake-up.
- Lease, attempt count, due time, recovery polling and bounded exponential retry.
- Tenant-bound `BeginDelivery`/completion and pre-provider `sending` marker.
- Ambiguous provider delivery fails closed as `delivery_state_unknown`; no blind resend.
- Transactional plan limits for Instagram accounts and automation rules.
- Rule validation covers match mode, keyword/exclusion/media sizes and reply limits.

### Inbox and product UI

- Automated comment private reply does not open manual messaging.
- Only idempotently stored inbound participant messages open/extend the 24-hour window.
- Manual sends require a stable `client_request_id`; migration `004_manual_delivery_idempotency.sql` enforces duplicate safety.
- Safe frontend retry reuses the same request ID until text changes or delivery succeeds.
- Unread Inbox filter, settings, team/invitations, audit and sessions are implemented.
- Owner can update non-owner roles, remove members and cancel invitations; owner/self protection and audit entries are server-side.
- Sidebar/action controls reflect backend role requirements while backend RBAC remains authoritative.
- Billing fails closed in production; development manual billing is explicitly demo.
- Legal/privacy pages exist; destructive data deletion remains manual review pending policy.

### Deployment and documentation

- Development and production Compose files.
- Non-root API/web images.
- Internal-only production PostgreSQL/Redis network.
- Nginx TLS proxy with rate limiting/security headers and Certbot volume/service.
- `docs/DEPLOYMENT.md`, Meta setup checklist and truthful test report.

## Architecture decisions not to undo

1. Never call Mock Mode real Meta integration.
2. Never authenticate an unverified registration.
3. Never put provider tokens, SMTP passwords, OAuth codes or raw webhook PII in frontend responses/logs.
4. Never remove workspace predicates or trust a client-supplied workspace ID.
5. Never route an external account without provider + deterministic active mapping.
6. Never make Redis the source of truth for jobs.
7. Never open the Inbox manual-reply window from a comment/private reply.
8. Never retry a provider call after an ambiguous `sending` state unless provider idempotency is proven.
9. Never silently select the first of multiple Unified Login assets.
10. Never save a Unified Login connection when account webhook subscription was not confirmed.
11. Never enable fake production billing or irreversible deletion to improve a completion percentage.
12. Never claim current tests passed when only an older revision was tested.

## Important files

- Config: `api/internal/config/config.go`
- Provider adapters/parser: `api/internal/provider/provider.go`
- OAuth/webhook endpoints: `api/internal/httpapi/instagram.go`
- Auth/workspace/mail: `api/internal/httpapi/auth.go`
- Inbox/team/audit/settings: `api/internal/httpapi/app.go`
- Transactions and durable queue: `api/internal/store/store.go`
- Worker: `api/internal/worker/worker.go`
- SQL: `api/internal/migrations/001_initial.sql` through `004_manual_delivery_idempotency.sql`
- PostgreSQL integration suite: `api/internal/store/store_integration_test.go`
- Accounts UI: `web/app/app/accounts/page.tsx`
- Inbox UI: `web/app/app/inbox/page.tsx`
- Settings UI: `web/app/app/settings/page.tsx`
- App shell/workspace switch: `web/components/app-shell.tsx`
- Production stack: `docker-compose.prod.yml`, `deploy/nginx/default.conf.template`

## Current test evidence

- Go unit, vet and server/migrate/seed build: PASS.
- Unified auth URL/exchange/account subscription/message delivery with controlled Meta-shaped HTTP: PASS, simulated only.
- HMAC/parser/token cipher/config security tests: PASS.
- Isolated disposable PostgreSQL 18 integration: PASS.
- Frontend ESLint, Vitest and Next production build: PASS.
- Playwright Edge Mock critical flow including duplicate comment, inbound DM and manual outbound reply: PASS.
- Production npm audit: 0 vulnerabilities.
- Full audit: 8 moderate dev-only `minimatch` findings in ESLint tooling; npm offers only breaking force-fix.
- Docker runtime: BLOCKED because Docker is not installed.
- Live Meta/SMTP/VPS: NOT TESTED/BLOCKED EXTERNAL.

Use `docs/TEST_REPORT.md` as the source of exact evidence and boundary explanations.

## External blockers

- Meta App ID/App Secret, approved test business/user/account and App Review/access.
- Live HTTPS callback/webhook and current official permission/field confirmation.
- Real SMTP credentials/domain.
- Authorized VPS/domain deployment.
- Owner/legal retention/deletion policy.
- Payment provider requirements if billing is expanded.

## Where to continue

Local current-revision gates are complete. Identify which external prerequisite is available:

1. With Meta credentials/approved account, follow `docs/META_SETUP_CHECKLIST.md` and `NEXT_STEPS` P0.1.
2. With Docker, run Compose build/start/health and containerized Mock E2E.
3. With SMTP, run live delivery/negative cases.
4. With a VPS/domain, execute the deployment/renewal/restore runbook.

Use exactly one approved Professional asset for the current Unified flow, sanitize evidence and never expose secrets. Change green code only in response to a reproduced failure.
