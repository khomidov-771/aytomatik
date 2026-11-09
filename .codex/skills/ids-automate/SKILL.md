---
name: ids-automate
description: Build and maintain IDS Automate, a multi-tenant Instagram comment-to-DM SaaS. Use for product implementation, UI, OAuth, Meta Graph API, webhooks, automation rules, inbox, billing, security, and tests.
---

# IDS Automate Skill

## Product goal
Build a polished multi-tenant SaaS that lets each customer connect their own Instagram Professional account using the official Instagram Login OAuth flow, configure comment keyword rules, and send policy-compliant Instagram private replies.

## Required workflow
1. Inspect repository and report existing stack, entry points, tests, and reusable code.
2. Compare repository against `docs/TECHNICAL_SPEC.md`.
3. Produce a short implementation plan with dependencies and risks.
4. Implement in vertical slices: shell/auth → tenant model → Instagram OAuth → webhook ingestion → rules → private reply → analytics → billing/settings.
5. Add tests and update docs for each slice.

## Product constraints
- Support Instagram Professional accounts (Business/Creator) only, subject to current Meta eligibility.
- Use official Meta APIs only. No scraping, browser automation, password collection, or unofficial endpoints.
- Never ask customers for Instagram passwords.
- Keep Instagram access tokens encrypted at rest; never expose tokens to browser logs or client bundles.
- Implement token expiry/refresh handling according to current official API behavior.
- Verify webhook signatures where supported and validate the `hub.challenge` handshake.
- Webhook handlers must be idempotent and fast; enqueue work and process asynchronously.
- Respect Meta's private-reply limits, allowed response timing, messaging policies, and user interaction windows. Do not send repeated unsolicited DMs.
- App Review / Advanced Access is required for external customer use where Meta requires it. Build a development/test mode and a production readiness checklist.
- Do not claim an integration is live until a real authorized API call succeeds.

## UX principles
- Uzbek-first interface.
- Clear empty states, loading, success, permission errors, disconnected account states, and retry affordances.
- Show what an automation will do before activation.
- Include pause/disable controls and a visible audit log.
- Confirm destructive actions.
- Do not fabricate metrics; demo metrics must be clearly marked as demo.

## Engineering principles
- Tenant isolation at service and database layers.
- Validate all inputs server-side.
- RBAC for Owner, Manager, Operator, and Customer.
- Use structured logs with secrets redacted.
- Rate limit auth and webhook-related endpoints appropriately.
- Use database migrations and transactions.
- Add unit tests for rule matching, tenant access, webhook validation, and API error mapping.
- Keep provider-specific logic behind an Instagram client interface and a mock adapter.

## Definition of done
A feature is done only when:
- UI works at mobile and desktop breakpoints.
- Backend validation and authorization exist.
- Tests cover normal and failure paths.
- Loading/error/empty states exist.
- Docs and `.env.example` are updated.
