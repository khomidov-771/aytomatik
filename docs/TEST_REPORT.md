# Test report

## 2026-11-14 — CSS repair and post-deploy UI verification (`787542e`)

### Local release checks

```text
npm run lint:web      PASS
npm run test:web      PASS (2 tests)
npm run build:web     PASS (22 routes)
PostCSS globals.css   PASS
```

- Browser route sweep used schema-shaped API fixtures; 13 public/setup/workspace routes passed at 1440px and 390px with no page errors or horizontal overflow. Final post-change smoke retested `/`, `/setup`, `/app`, accounts, automation builder, Inbox, Analytics, and Settings at both widths.
- CSS bundle inspection found no `unparsable` marker and confirmed the global reset and dashboard grid rules. The production bundle was rebuilt after the final palette changes.

### Live deployment smoke (no Meta actions)

- GitHub `main` moved from `7644b30` to `787542e`. The clean archive SHA-256 matched on the server. Only `ids-automate-web-1` was recreated with `--no-deps`; API, PostgreSQL, Redis, Nginx, production environment values, and database were not restarted or changed.
- Production `/` and `/_next/static/chunks/2d-19ue1mc7_2.css` returned HTTP 200. The asset includes reset/grid rules and no parse-error marker. Edge loaded both linked CSS assets at HTTP 200; live homepage document width matched the viewport at 1440px and 390px. All four REPLEO containers were healthy after deployment; API/PostgreSQL start times were unchanged. Rollback image `ids-automate-web:rollback-repleo-20261114` is present.
- No Instagram OAuth consent, comment, DM, or public reply was triggered during this UI deployment. Historical Meta evidence below is not fresh acceptance.

## 2026-11-14 — Previous full-stack checkpoint (`78695c2`)

### Local workspace

```text
npm run lint:web                                                PASS
npm run test:web                                                PASS (2 tests)
npm run build:web                                               PASS (22 routes)
npm run test:e2e                                                PASS (1 flow, local production build)
go test ./...                                                   PASS
go vet ./...                                                    PASS
go build ./cmd/server ./cmd/migrate                             PASS
go test -tags=integration -v ./internal/store ./internal/httpapi PASS (embedded PostgreSQL)
```

### Production deployment and checks

- Built and deployed only `web` from GitHub commit `78695c2`. API, PostgreSQL, Redis, Nginx, production env, and database were not changed. The pre-deploy image is retained for rollback.
- The E2E flow against the deployed UI passed (1 test); it stubs auth/status API responses and does not complete OAuth. Site title is `REPLEO` (HTTP 200); `/repleo-night-hero.jpg` is HTTP 200 `image/jpeg`. New web container is healthy; API, PostgreSQL, and Redis remained healthy.
- `/healthz` and `/api/v1/auth/instagram/status` returned HTTP 200 (`status=ok`, Instagram login enabled and API-ready). Production OAuth-start returned HTTP 200 for both `register` and `login` intents with an official Instagram authorize URL. Missing terms returned 422, untrusted Origin 403. No browser consent/callback was completed.
- Anonymous `/me`, account, automation, Inbox, analytics, and audit APIs returned 401. Invalid webhook verification returned 403; unsigned webhook POST returned 401.
- PII-free production aggregates: 1 connected Meta account, 25 processed `comment_created` events, 12 completed executions, 11 successful Meta private-reply actions with provider result IDs, 12 successful Meta public-reply actions with result IDs. All 11 private successes completed before their public replies. One provider follow-check error became `UNKNOWN`; policy skipped the DM and a public reply succeeded. Inbox history has 8 inbound `received` and 12 outbound `sent` Meta messages with provider IDs. No follower/non-follower live result was established.
- No new comment or message was sent during these checks. The recorded Meta actions are historical production evidence; no fresh comment was triggered after deployment.

### Dependency audit

- `npm audit --omit=dev`: 0 vulnerabilities.
- Full `npm audit`: 7 moderate advisories in the build/lint-only `typescript-eslint` → `minimatch` dependency tree; no high/critical findings. The final standalone runtime image contains neither `@typescript-eslint` packages nor the vulnerable lint toolchain. Upstream `typescript-eslint@8.72.2` still resolves vulnerable `minimatch@10.2.6`; a forced major override was rejected as unverified and is not present in the release.

These results do not establish 100% completion: follow verification, fresh OAuth callback acceptance, fresh Inbox UI/manual-reply acceptance, and a new post-deploy comment delivery remain unverified. Existing production records do show historical inbound/outbound Meta messages.

Sana: 2026-11-10.

## Bajarilgan komandalar

```text
go test ./...                                                   PASS
go vet ./...                                                    PASS
go build ./cmd/server ./cmd/migrate                             PASS
go test -tags=integration ./internal/store -run TestTenant...  PASS
npm run lint:web                                                PASS
npm run test:web                                                PASS (2 tests)
npm run build:web                                               PASS (21 routes)
```

## Qamrov

Backend testlari:

- production config va test-only mock guard;
- OAuth URL/config ID va controlled token exchange;
- Unified assigned-account/subscription flow;
- Instagram Login follow `true`/`false`/missing-field semantics;
- Unified follow → `UNKNOWN`;
- private/public reply request construction;
- connected account media list request host/path/bearer/fields for Instagram va Unified login;
- webhook signature/payload parsing;
- AES token encryption va auth/security primitives;
- keyword/media matching;
- follow disabled/FOLLOWER/NOT_FOLLOWER/UNKNOWN workflow decisions;
- PostgreSQL migration, tenant isolation, queue claim;
- action idempotency, private dedup, public safe retry, execution history;
- Inbox inbound/manual message idempotency.

Frontend:

- ESLint va TypeScript production compile;
- matcher unit tests;
- 21 route prerender/build;
- E2E spec demo/mock yo‘llardan tozalangan, lekin live server stack va real Meta credentials bo‘lmagani uchun bu sessiyada ishga tushirilmagan.

## Environment izohi

Docker CLI topilmadi. Integration test in-memory/mock DB emas: cached embedded PostgreSQL 18.6.1 Windows processi ishga tushirilib, migration va SQL assertions real PostgreSQL’da bajarildi.

Frontend standalone build cheklangan processda Windows `EPERM` berdi. Generated `.next` xavfsiz tozalanib odatiy Windows huquqida qayta ishga tushirilganda build to‘liq PASS bo‘ldi.

## Live Meta holati

Quyidagilar **NOT TESTED LIVE**:

- real OAuth consent va token exchange;
- token expiry/refresh/revoke;
- App Review permissionlari;
- public HTTPS webhook verification va real signed payload;
- `is_user_follow_business` real follower/non-follower/unknown;
- one-private-reply va vaqt oynasi;
- private reply real delivery;
- public comment reply real delivery;
- Meta rate limit va policy rejection;
- real inbound DM/manual reply.
- connected account `/{ig-user-id}/media` response va visual picker.

Sabab: Meta App ID/App Secret, tasdiqlangan eligible account/test user va public HTTPS callback bu workspace’da mavjud emas.

Controlled Meta-shaped HTTP testlar live integratsiya deb hisoblanmaydi.
