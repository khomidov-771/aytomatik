# Implementation status

Last updated: 2026-11-09.

- [x] Phase 0 — repository audit
- [x] Phase 1 — design system and UI shell
- [x] Phase 2 — authentication and tenancy implementation
- [x] Phase 3 — provider abstraction, Mock Mode and Meta Unified Login implementation
- [x] Phase 4 — signed webhooks, durable queue and automation rules
- [x] Phase 5 — Inbox, manual delivery idempotency and analytics
- [x] Phase 6 — plan limits, settings, security hardening and deployment configuration

These checks mean the planned code exists; they do not mean every external acceptance gate passed. Current local unit/build/PostgreSQL/Mock E2E gates pass. Real Meta, real SMTP, Docker runtime, App Review and a live VPS deployment remain unverified or blocked.

## Main implementation outputs

- Next.js application in `web/` with public, auth and tenant application surfaces.
- Go API in `api/` with PostgreSQL migrations, opaque sessions, CSRF, RBAC and tenant-scoped stores.
- Mock and Meta adapters behind one provider interface.
- Facebook Login for Business / Instagram API Unified Login using configuration `2331645327602552`.
- Signed webhook normalization, database-backed queue leases, no-blind-resend delivery markers and Redis wake-up signals.
- Inbox policy window, duplicate-safe inbound events and client-request-id-protected manual sends.
- Docker development and production Compose, Nginx HTTPS proxy and Certbot runbook.
- README, architecture, status, next steps, handoff, deployment, Meta and test documentation.

## Deliberate product boundaries

- Mock Mode is always marked demo and never represents real Instagram delivery.
- Billing is disabled in production until a payment provider is selected and implemented.
- Data deletion creates a manual-review audit request until retention/legal requirements are approved.
- Campaigns group automation rules by account; no unsupported standalone campaign lifecycle is claimed.
- CSV export and social login are visibly disabled instead of simulated.
