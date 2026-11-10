# Implementation plan

Bu tarixiy reja 2026-11-10 core scope’ga moslashtirilgan. Amaldagi ustuvorliklar `NEXT_STEPS.md`da.

## Yakunlangan kod bosqichlari

1. Repository audit va design system.
2. Authentication, sessions, CSRF, RBAC va multi-tenancy.
3. Instagram/Unified Login provider abstraction va encrypted tokens.
4. Signed webhook, durable PostgreSQL queue va idempotency.
5. Keyword/media automation builder.
6. Tri-state optional follow check.
7. Private reply → confirmed success → public reply state machine.
8. Per-action execution history va Inbox.
9. Product UI/API’dan payment, demo va fake data scope’ini olib tashlash.

## Qolgan acceptance bosqichi

Real Meta eligible account bilan OAuth, webhook, follow, private reply, public reply, duplicate va failure outcome’larini dalillash. Batafsil `NEXT_STEPS.md`.
