# Test report

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

Sabab: Meta App ID/App Secret, tasdiqlangan eligible account/test user va public HTTPS callback bu workspace’da mavjud emas.

Controlled Meta-shaped HTTP testlar live integratsiya deb hisoblanmaydi.
