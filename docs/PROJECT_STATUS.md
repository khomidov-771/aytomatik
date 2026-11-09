# IDS Automate project status

Status date: 2026-11-09. Repository: `C:\Users\secre\Desktop\1\IDS_Automate_Codex_Pack`.

## Executive status

- **Implementation:** required MVP code is present across frontend, backend, PostgreSQL, auth/tenancy, automation, Inbox, Mock Mode, Meta Unified Login and deployment configuration.
- **Current revision local gates:** Go unit/vet/build, frontend lint/unit/production build, PostgreSQL integration and Playwright Mock critical flow PASS.
- **Unified Login code-level flow:** PASS with a controlled Meta-shaped HTTP transport; live Meta remains NOT TESTED.
- **Real Meta integration:** BLOCKED EXTERNAL — App credentials, approved Professional account, live webhook and App Review/access evidence are absent.
- **Real SMTP:** NOT TESTED.
- **Docker Compose runtime:** BLOCKED on this workstation because Docker CLI/runtime is not installed. Equivalent PostgreSQL tests passed with local disposable PostgreSQL 18.
- **Production deployment:** configured, not deployed or VPS-verified.
- **Acceptance evidence score:** **12.5/14 = 89.3%** using the deterministic table below.

The platform is not 100% production-ready until live Meta, SMTP, Docker/VPS/HTTPS, restore and responsive/accessibility gates have evidence.

## Module status

| Module | Actual status | Evidence / limitation |
|---|---|---|
| Register/verify/login/logout | PASS locally | Playwright critical flow + Go tests |
| Password reset/session rotation | PASS code/unit/integration | Real SMTP reset delivery not tested |
| Multi-tenant/RBAC | PASS | PostgreSQL isolation plus role tests; owner protection/member management included |
| Team management | PASS locally | Invite/accept, role update, removal, cancellation and audit; integration/build green |
| Mail | PARTIAL | Safe log adapter and STARTTLS production gates pass; live SMTP absent |
| Mock Instagram | PASS | OAuth/demo delivery/comment/inbound/manual reply E2E; never real delivery |
| Meta Unified Login adapter | PASS code-level | Auth URL, config ID, token exchange, asset discovery, subscription and message delivery simulated; no live credentials |
| OAuth state/token safety | PASS locally | One-time workspace/user state integration + AES-256-GCM roundtrip/non-plaintext test |
| Webhooks | PASS code-level | HMAC, comment/message parser, nested media ID, echo/self filters and DB event idempotency pass; no live fixture |
| Automation/durable queue | PASS locally | Rule tests, DB leases/idempotency/delivery marker and browser duplicate event pass |
| Inbox/DM | PASS in Mock Mode | Inbound opens 24-hour window; client-idempotent manual outbound E2E passes; live Meta DM absent |
| Analytics/audit/settings | PASS locally | Current lint/build and persisted-data implementation |
| Billing | Deliberately disabled in production | Manual development demo only; no payment provider claimed |
| Privacy deletion | Manual review by design | Destructive retention/legal policy not approved |
| Frontend | PASS desktop critical flow | Lint, Vitest, production build and Edge Playwright pass; full 360/768/1440 accessibility matrix not run |
| Deployment configuration | Implemented, unverified runtime | Compose/Nginx/Certbot/runbook exist; Docker/VPS unavailable |

## Unified Login implementation and evidence

Configuration supplied by the user:

- Product: `Instagram API (Unified Login)`
- Compatibility: `Instagram Login Compatible`
- Configuration ID: `2331645327602552`

Implemented behavior:

1. `META_LOGIN_MODE=unified` and required `META_LOGIN_CONFIG_ID` startup validation.
2. `facebook.com/dialog/oauth` URL with App ID, Configuration ID, exact redirect and single-use state.
3. Versioned Facebook Graph code exchange.
4. Cursor-paginated assigned Instagram account discovery with dedupe/repeated-cursor/100-page safeguards.
5. Fail-closed zero/multiple asset handling; no silent first-account selection.
6. `subscribed_apps` confirmation for `messages,comments,messaging_postbacks` before persistence.
7. Granted-permission metadata, encrypted token persistence boundary and token expiry metadata.
8. Unified Graph message/private-reply delivery and best-effort unsubscribe/revoke on disconnect.
9. Accounts/settings UI identifies the active login mode.

`TestUnifiedAuthorizationURLUsesConfigurationID` and `TestUnifiedOAuthExchangeSubscriptionAndMessageDelivery` pass against controlled Meta-shaped responses. These tests prove request construction/handling, not Meta approval or live reachability.

## Acceptance evidence

Scoring: `1` = current applicable test evidence; `0.5` = implemented but incomplete browser/external evidence; `0` = required live evidence absent.

| # | Criterion | Score | Current evidence |
|---:|---|---:|---|
| 1 | Register, verify, login, logout | 1 | Green Playwright critical flow |
| 2 | Workspace and tenant isolation | 1 | Green PostgreSQL integration + RBAC tests |
| 3 | OAuth; Mock Mode completes locally | 1 | Unified request tests + Mock browser flow |
| 4 | Real mode rejects missing credentials | 1 | Current config tests |
| 5 | Safe connected-account metadata | 1 | DTO/token boundary and build tests |
| 6 | Automation CRUD | 1 | Rule/store/frontend tests and build |
| 7 | Duplicate event triggers once | 1 | PostgreSQL marker + browser duplicate assertion |
| 8 | Mock reply explicitly demo | 1 | UI/E2E Demo markers |
| 9 | Real private reply after official eligibility/API success | 0 | No approved live Meta run |
| 10 | Metrics derive from stored data | 1 | SQL implementation and green build/tests |
| 11 | Token never exposed | 1 | Cipher/non-plaintext test + server-only DTO design |
| 12 | Automated role/tenant tests | 1 | Current Go/PostgreSQL pass |
| 13 | Mobile/desktop usable | 0.5 | Responsive implementation; full viewport/accessibility matrix missing |
| 14 | Setup and environment docs complete | 1 | Required handoff/deployment/test docs present |

Total: `12.5 / 14 × 100 = 89.3%`.

## Current test summary

- `go test ./...`: PASS.
- `go vet ./...`: PASS.
- `go build ./cmd/server ./cmd/migrate ./cmd/seed`: PASS.
- Unified provider/security/config verbose tests: PASS.
- `go test -tags=integration -v ./internal/store` on isolated PostgreSQL 18 database: PASS.
- `npm run lint`: PASS.
- `npm test -- --run`: PASS, 2 tests.
- `npm run build`: PASS outside restricted Windows sandbox, 24 routes.
- Playwright Edge critical flow: PASS, 1 test.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- Full `npm audit`: 8 moderate dev-only `minimatch` findings in ESLint tooling; no safe non-breaking automatic fix offered.
- Docker Compose config/start: BLOCKED, `docker` executable not installed.

Exact commands and boundaries: `docs/TEST_REPORT.md`.

## Remaining release blockers

### External

- Real Meta App ID/App Secret, approved business/test user, one Professional account and App Review/access.
- Live HTTPS OAuth callback, signed webhook delivery and policy-eligible DM/private reply proof.
- Real SMTP provider/domain and registration/reset/invitation delivery proof.
- Authorized staging/VPS/domain.
- Owner/legal retention and destructive deletion policy.
- Payment-provider requirements if production billing is desired.

### Operational/verification

- Docker Compose build/start/health validation on a Docker host.
- 360/768/1440 browser and accessibility matrix.
- HTTPS certificate issue/renewal test, backup/restore drill and alerting verification.
- Resolve or accept the dev-only audit finding when upstream offers a non-breaking patched dependency tree.

## Explicit non-claims

- Mock Mode and Meta-shaped HTTP simulation are not live Meta integration.
- Configuration ID alone is not an App credential or App Review approval.
- Production build success is not a production deployment.
- Disabled billing and manual-review deletion are not implemented external services.
