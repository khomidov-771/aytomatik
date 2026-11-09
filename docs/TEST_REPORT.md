# IDS Automate test report

Report date: 2026-11-09. Tests below ran against the current revision unless explicitly marked external/blocked.

## Quality gate summary

| Gate | Result | Evidence boundary |
|---|---|---|
| Go format | PASS | Modified Go files formatted with `gofmt` |
| Backend unit | PASS | `go test ./...` |
| Backend vet | PASS | `go vet ./...` |
| Backend build | PASS | server, migrate and seed commands |
| Unified OAuth adapter | PASS (simulated) | Controlled Meta-shaped HTTP responses, not live Meta |
| Token encryption | PASS | AES-GCM roundtrip and plaintext-absence assertion |
| Webhook verification/parser | PASS | HMAC, comment, inbound, nested media and echo/self tests |
| PostgreSQL integration | PASS | Isolated disposable PostgreSQL 18 database |
| Frontend lint | PASS | ESLint, no reported errors/warnings |
| Frontend unit | PASS | Vitest: 1 file, 2 tests |
| Frontend production build | PASS | Next 16, TypeScript and 24 routes |
| Browser critical flow | PASS in Mock Mode | Playwright Edge: 1 test |
| Production npm audit | PASS | `npm audit --omit=dev`: 0 vulnerabilities |
| Full npm audit | PARTIAL | 8 moderate dev-only findings in ESLint dependency chain |
| Docker Compose runtime | BLOCKED | Docker CLI/runtime not installed on this workstation |
| Live Meta | BLOCKED EXTERNAL | Credentials/account/review not supplied |
| Live SMTP | NOT TESTED | SMTP provider not supplied |
| VPS/HTTPS/restore | NOT TESTED | No authorized target host |

## Backend

### Unit, vet and build

```text
go test ./...                                      PASS
go vet ./...                                       PASS
go build ./cmd/server ./cmd/migrate ./cmd/seed     PASS
```

Tested packages include config, HTTP API role logic, mailer, provider, rules, security and store.

### Unified Login, webhook and token tests

```text
TestUnifiedAuthorizationURLUsesConfigurationID          PASS
TestUnifiedOAuthExchangeSubscriptionAndMessageDelivery PASS
TestWebhookSignature                                   PASS
TestParseNormalizedEvent                               PASS
TestParseInboundMessage                                PASS
TestParseMetaCommentUsesNestedMediaID                  PASS
TestParseIgnoresEchoAndSelfMessage                     PASS
TestPasswordAndTokenCipher                             PASS
TestPasswordRejectsBcryptTruncationBoundary            PASS
TestProductionRequiresSecureSMTP                       PASS
TestProductionRejectsDemoBilling                       PASS
TestProductionRequiresSecurePublicURLsAndCookie        PASS
TestUnifiedMetaRequiresConfigurationID                 PASS
```

The Unified OAuth test verifies the Configuration ID, code exchange, bearer-authenticated assigned-account discovery, one-account normalization, `subscribed_apps`, granted permission metadata and Unified message delivery. It uses a controlled HTTP transport; it does not prove Meta accepted the application or a real account.

The cipher test proves ciphertext differs from and does not contain the plaintext token, then decrypts correctly with the configured key. API DTOs do not expose ciphertext.

### PostgreSQL integration

Docker was requested but unavailable because `docker` is not installed. The suite was therefore run against a cached disposable PostgreSQL 18 server using a dedicated database named `ids_integration_current`; it was removed after the run.

```text
go test -tags=integration -v ./internal/store
TestNormalizeRule                    PASS
TestNormalizeRuleLimits              PASS
TestTenantTokensInboxAndQueue        PASS
```

The integration covers one-time email/OAuth state, workspace binding, invitation/role/owner protection, cross-tenant account protection, inbound DM idempotency, reply window, durable claim, duplicate/cross-tenant delivery markers and manual outbound request idempotency.

An initial attempt pointed at a reused `postgres` database and failed on a duplicate test email. The final authoritative run used a clean dedicated database and passed. No production/user database was used.

## Frontend

```text
npm run lint          PASS
npm test -- --run     PASS — 1 file, 2 tests
npm run build         PASS — TypeScript + 24 routes
```

The first restricted-sandbox build attempt hit Windows `EPERM` while Next created a prerender segment directory. The same build was rerun outside that filesystem restriction and passed. Vitest configuration was renamed to `.mts`; the prior CJS/ESM warning is removed.

## Browser E2E

Playwright ran against a fresh dedicated PostgreSQL database, locally started API, Next dev server and `INSTAGRAM_PROVIDER=mock`:

```text
registration, mock automation and inbox critical flow   PASS (8.6s)
1 passed                                                PASS (10.4s total)
```

Covered: landing/terms, register, development email verification, login/logout, seeded demo login, automation load, duplicate comment rejection, inbound DM, 24-hour Inbox reply window and client-idempotent outbound manual DM.

This is explicitly a Mock Mode product-flow test. It is not evidence of live Instagram delivery.

## Dependency security

```text
npm audit --omit=dev    PASS — 0 vulnerabilities
npm audit               8 moderate vulnerabilities
```

All eight full-audit findings originate from `minimatch@10.2.6` through ESLint/TypeScript-ESLint development tooling. Npm’s automatic fix requires `--force` and proposes a breaking `eslint-config-next` downgrade. A patched override was evaluated but npm did not apply it to the nested tree; it was not left as a false fix. Runtime/production dependencies are clean in the recorded audit.

## Blocked or not tested

### Real Meta — BLOCKED EXTERNAL

Missing: Meta App ID/App Secret for configuration `2331645327602552`, approved business/test user, one Instagram Professional account, applicable review/access and public HTTPS callback/webhook. Real OAuth, token lifetime, live subscription/payload, private reply/manual DM, rate limits and revoked-token behavior remain NOT TESTED live.

### Docker — BLOCKED

`docker version`, `docker compose version` and `docker compose config` could not run because the `docker` command is absent. Compose files are not labeled runtime-verified.

### SMTP and operations — NOT TESTED

No SMTP provider, VPS/domain, certificate endpoint, alert target or backup destination was supplied. STARTTLS/config behavior is unit-tested, but delivery, deployment, renewal and restore remain open gates.
