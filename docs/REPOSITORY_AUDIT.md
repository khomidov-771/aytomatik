# Repository audit

Audit date: 2026-11-08 (Asia/Tashkent)

## Initial state

The repository was a specification pack, not an application. It contained the product brief, design reference, Meta setup checklist, environment example, implementation plan and project skill. There was no Git metadata, package manifest, application entry point, database migration or automated test.

## Reusable assets preserved

- `AGENTS.md` and `.codex/skills/ids-automate/SKILL.md` — binding engineering workflow.
- `docs/TECHNICAL_SPEC.md` — product, API, data, security and acceptance requirements.
- `docs/DESIGN_GUIDE.md` and `design/ids-automate-reference.png` — visual language.
- `docs/META_SETUP_CHECKLIST.md` — production readiness checklist.
- `.env.example` — expanded rather than replaced with secrets.

## Chosen implementation

- Web: Next.js App Router, React, TypeScript and CSS design tokens.
- API: Go HTTP service with PostgreSQL persistence and an optional Redis-backed job signal.
- Auth: opaque server-side sessions in HttpOnly cookies, CSRF header validation and bcrypt cost 12 passwords.
- Tenancy: workspace membership resolved on the server; all protected repositories require `workspace_id`.
- Instagram: provider interface with explicit `mock` and fail-closed `meta` adapters.
- Infra: Docker Compose, PostgreSQL and Redis health checks, embedded SQL migrations and a demo seed command.

## Entry points

- Web: `web/app/page.tsx` and `web/app/app/layout.tsx`.
- API: `api/cmd/server/main.go`.
- Migrations: `api/cmd/migrate/main.go`.
- Demo seed: `api/cmd/seed/main.go`.

## Initial risks

- Meta credentials and Advanced Access are not present; only mock delivery can be verified locally.
- Meta fields, API versions and review rules are externally mutable; production mode is configuration-gated and must be revalidated against official docs before launch.
- The initial workstation did not have system Go, Docker, PostgreSQL or Redis. A repository-local Go toolchain was used, and a later disposable PostgreSQL 18 integration run passed. Production Compose/Redis/VPS behavior still requires its own authorized verification.

