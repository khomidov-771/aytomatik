# Repository audit

Initial audit: 2026-11-08. Re-audit: 2026-11-10.

## Boshlang‘ich holat

Repository specification/design pack sifatida boshlangan. Keyin Next.js frontend, Go API, PostgreSQL schema/migrations, provider abstraction va testlar qo‘shilgan.

## Joriy entrypointlar

- Web: `web/app/page.tsx`, `web/app/app/layout.tsx`
- API: `api/cmd/server/main.go`
- Migration: `api/cmd/migrate/main.go`
- Core worker: `api/internal/worker/worker.go`
- Meta adapter: `api/internal/provider/provider.go`

Demo seed entrypoint olib tashlangan. Test-only mock adapter productda route/UI yoki credential yaratmaydi.

## Saqlangan aktivlar

- `AGENTS.md` va project skill qoidalari
- Design reference va custom CSS language
- Auth/tenant/security bazasi
- Durable queue/idempotency modeli
- Existing production-compatible migrations va ma’lumotlar

## Joriy risklar

- Live Meta credentials/App Review/eligible account yo‘q.
- Follow capability login path va messaging contextga bog‘liq.
- Legacy plan/subscription schema migration tarixini saqlash uchun fizik database’da qoladi, lekin application ishlatmaydi.
- Docker CLI audit workstation’da mavjud emas; PostgreSQL integration embedded real process bilan o‘tgan.

Source of truth: `PROJECT_STATUS.md` va `NEXT_STEPS.md`.
