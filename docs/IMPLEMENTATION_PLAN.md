# Implementation plan

## Phase 0 — Repository audit
- Inspect existing frontend/backend and package manifests.
- Identify reusable auth, DB, routing, styling and tests.
- Write `docs/REPOSITORY_AUDIT.md`.
- Do not overwrite existing app blindly.

## Phase 1 — Design system and UI shell
- Add tokens, typography, buttons, cards, forms, sidebar, topbar.
- Implement landing, login, register, dashboard shell.
- Use static demo data only with explicit demo labels.
- Responsive and accessible.

## Phase 2 — Authentication and tenancy
- Register/login/logout, password reset, email verification dev adapter.
- Workspace creation and RBAC.
- Tenant isolation tests.

## Phase 3 — Instagram provider abstraction
- Define provider interface.
- Implement mock provider and tests.
- Add OAuth state/callback flow.
- Add real Meta adapter only after verifying current official docs and app config.

## Phase 4 — Webhooks and automations
- Webhook verification and signature checks.
- Event persistence, queue, idempotency.
- Rule editor and matching engine.
- Policy eligibility checks and execution logs.

## Phase 5 — Inbox and analytics
- Conversations/messages where API access permits.
- Analytics from persisted events and executions.
- Empty/error/loading states.

## Phase 6 — Billing, settings, production readiness
- Plan limits and subscription states.
- Data deletion, audit logs, security review.
- App Review checklist, privacy policy, terms, deployment docs.

## Required outputs
- Working app, not just static mockups.
- `README.md`, `.env.example`, migrations, tests.
- `docs/REPOSITORY_AUDIT.md`, `docs/IMPLEMENTATION_STATUS.md`.
