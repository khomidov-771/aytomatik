# IDS Automate architecture

## System overview

```text
Next.js browser UI
  └─ cookie + CSRF JSON API
      └─ Go net/http service
          ├─ PostgreSQL: tenant data, sessions, durable queue, audit
          ├─ Redis: optional job wake-up signal
          ├─ Instagram adapter: mock or Meta
          └─ Mail adapter: dev log or STARTTLS SMTP
```

PostgreSQL is the source of truth. Redis is optional: when unavailable, event IDs are signalled through an in-process channel; the worker also polls due database jobs, so restarts and lost Redis signals do not lose persisted events.

## Repository layout

| Path | Responsibility |
|---|---|
| `web/app` | Next App Router pages: marketing, auth, dashboard, Inbox, audit, Mock Lab |
| `web/components` | Reusable shell, UI, automation builder, charts |
| `web/hooks/use-api.ts` | Credentialed API loading/reload state |
| `web/lib/api.ts` | API base URL, cookies, CSRF propagation, structured errors |
| `api/cmd/server` | Config, migrations, worker and HTTP server startup |
| `api/cmd/seed` | Verified demo user/account/rule seed |
| `api/internal/httpapi` | Routes, auth/RBAC/CSRF, validation and response mapping |
| `api/internal/store` | Tenant-scoped PostgreSQL queries and transactions |
| `api/internal/provider` | `mock` and `meta` Instagram adapters, webhook normalization |
| `api/internal/worker` | Durable comment processing, matching and delivery |
| `api/internal/mailer` | Explicit dev log adapter and STARTTLS SMTP adapter |
| `api/internal/security` | Password hashing, AES-GCM, random/hash helpers |
| `api/internal/migrations` | Ordered embedded SQL migrations |

## Frontend

The frontend is a client-driven Next.js dashboard. All product counts and rows are loaded from the backend; Mock Mode is shown with a badge. Auth links that carry reset/verify/invitation tokens use `useSearchParams` inside Suspense boundaries.

Important UI flows:

- Register → email verification → login.
- Workspace selector → CSRF-protected session rotation → reload under the new tenant.
- Mock Lab → comment event → automated private reply → inbound DM → Inbox manual reply window.
- Profile → active sessions → revoke.
- Audit page is visible to manager/owner roles.

## Backend layers

### HTTP and security

`httpapi.Server` uses Go 1.22+ method-aware `ServeMux` routes. Protected writes require:

1. valid HttpOnly `ids_session` cookie;
2. unexpired session belonging to a verified user;
3. required workspace role;
4. matching `X-CSRF-Token`.

Role order is `customer < operator < manager < owner`. Every business query receives the active `workspace_id`. Workspace switching first validates membership, then deletes the current session and creates a new token/CSRF pair in one transaction.

### Instagram provider boundary

`provider.Instagram` supplies OAuth, webhook signature/parsing and delivery operations. Only one provider is active per process.

- `mock`: local OAuth and deterministic simulated delivery. It is never described as real delivery.
- `meta`: Meta Graph calls and HMAC verification. `META_LOGIN_MODE=unified` uses Facebook Login for Business with `config_id`; `META_LOGIN_MODE=instagram` keeps the direct Instagram Login adapter for an existing legacy configuration.

Unified Login flow:

1. `/instagram/connect` sends the user to `facebook.com/dialog/oauth` with `client_id`, `config_id`, exact `redirect_uri` and one-time `state`.
2. The callback exchanges the code on versioned `graph.facebook.com`.
3. `/me/assigned_instagram_accounts` is paginated with cursor-loop and page-count safety limits.
4. The connection is rejected when no asset or more than one Professional asset is shared; the server never silently chooses an account.
5. The chosen account is subscribed to `messages`, `comments` and `messaging_postbacks` through `/{ig-id}/subscribed_apps` before encrypted token persistence.
6. Delivery calls use the Graph host matching the login mode.

`META_LOGIN_CONFIG_ID=2331645327602552` came from the supplied Meta configuration screen. It is public configuration metadata, not a secret. App ID, App Secret, webhook secrets and access tokens remain server-only. Real runtime validation still requires those credentials, a permitted Professional account and the applicable App Review access.

Webhook parsing normalizes only supported comment and inbound-message events. Echo/self messages are ignored. Unknown fields are ignored; invalid JSON fails. Raw payload is not persisted: only a redacted/minimal normalized payload is stored.

### Comment processing and no-double-send boundary

1. Signed webhook is parsed.
2. `(provider, instagram_user_id)` resolves exactly one active account/workspace.
3. `provider_event_id` is inserted once into `webhook_events`.
4. Worker claims a database lease and increments `attempt_count`.
5. Policy and active rule checks run.
6. Before the external API call, `automation_executions.status='sending'` is committed.
7. If that marker already exists, recovery fails closed with `delivery_state_unknown`; it never blindly sends a second private reply.
8. Successful/failed delivery updates execution and event status.

Pre-delivery infrastructure failures are retried with exponential delay, at most five attempts. Provider-call failures are not automatically resent because timeout/transport state may be ambiguous.

### Inbox policy

- An automated private reply creates an outbound Inbox record but does not open `can_reply_until`.
- Only a verified inbound participant message inserts an inbound message and opens/extends the 24-hour manual reply window.
- Provider message ID has a partial unique index; duplicate inbound events neither increment unread count nor extend the window.
- Manual send checks the window again server-side immediately before provider delivery.

## Database model

Core tables:

- Identity: `users`, `workspaces`, `workspace_members`, `sessions`, `one_time_tokens`, `oauth_states`.
- Instagram: `instagram_accounts`, `automation_rules`.
- Queue/execution: `webhook_events`, `automation_executions`.
- Inbox: `conversations`, `messages`.
- Product: `plans`, `subscriptions`, `team_invitations`, `audit_logs`.

Key constraints:

- `users.email` unique (`citext`).
- membership primary key `(workspace_id,user_id)`.
- connected provider identity unique on `(provider,instagram_user_id)`.
- event ID unique on `webhook_events.provider_event_id`.
- provider message ID unique when non-null.
- one execution per event.
- one conversation per workspace/account/participant.

Migration history:

- `001_initial.sql`: complete base schema and plans.
- `002_inbox_policy_and_tenant_routing.sql`: legacy mock-ID conversion, deterministic active provider identity, message idempotency.
- `003_durable_webhook_queue.sql`: attempts, due time, lease and recoverable queue index.
- `004_manual_delivery_idempotency.sql`: unique client request key for safe manual Inbox delivery retries.

## Authentication and mail

- Passwords use bcrypt cost 12 helpers in `internal/security`.
- Register creates an unverified user and one-time token; it does not create an authenticated session.
- Login rejects unverified email.
- Reset consumes one token and revokes all sessions.
- Creating a new token invalidates older unused tokens for that purpose.
- Development `MAIL_PROVIDER=log` logs an explicit non-delivery record and returns dev tokens to the UI.
- Production configuration refuses to start unless SMTP and STARTTLS are enabled.

## API endpoints

### Public/auth

- `GET /healthz`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/me`

### Workspace/security

- `GET /api/v1/workspaces`
- `POST /api/v1/workspaces/{id}/switch`
- `GET /api/v1/sessions`
- `DELETE /api/v1/sessions/{id}`
- `GET /api/v1/audit-logs`

### Instagram/automation

- `GET /api/v1/instagram/connect`
- `GET /api/v1/instagram/callback`
- `GET /api/v1/instagram/accounts`
- `DELETE /api/v1/instagram/accounts/{id}`
- `GET|POST /api/v1/automations`
- `GET|PATCH|DELETE /api/v1/automations/{id}`
- `GET|POST /api/v1/webhooks/instagram`
- `POST /api/v1/webhooks/instagram/mock-event` (mock only)
- `POST /api/v1/webhooks/instagram/mock-message` (mock only)

### Product

- `GET /api/v1/inbox/conversations`
- `GET|POST /api/v1/inbox/conversations/{id}/messages`
- `GET /api/v1/analytics/summary`
- `GET|PATCH /api/v1/billing/plan`
- `GET /api/v1/team`
- `POST /api/v1/team/invitations`
- `DELETE /api/v1/team/invitations/{id}`
- `POST /api/v1/team/invitations/accept`
- `PATCH /api/v1/team/members/{id}`
- `DELETE /api/v1/team/members/{id}`
- `GET|PATCH /api/v1/settings`
- `POST /api/v1/settings/data-deletion-request`

## Deployment and observability

Docker images run as non-root users. The API applies migrations on startup. Health checks include PostgreSQL and report provider/demo/queue signal state. Settings reports persisted queued and recent failed events. Secrets must be supplied by the deployment platform, not baked into images.

Current operational gaps are recorded in `PROJECT_STATUS.md` and `NEXT_STEPS.md`. Current-revision PostgreSQL integration and Mock browser E2E pass. Docker runtime is unavailable on this workstation; real Meta, real SMTP and an actual VPS deployment remain external verification gates.
