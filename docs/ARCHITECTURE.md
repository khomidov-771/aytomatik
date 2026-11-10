# IDS Automate arxitekturasi

Tekshiruv sanasi: 2026-11-10.

## Tizim oqimi

```text
Meta Webhook
  → HMAC verification
  → provider payload parser
  → PostgreSQL webhook_events (durable queue)
  → worker claims event
  → active rule + keyword/media match
  → optional tri-state follow check
  → private reply action
  → confirmed success bo‘lsa public success reply
  → execution/action history
```

`NOT_FOLLOWER` branch private reply yubormaydi. `UNKNOWN` branch automation egasi tanlagan `send_private_reply` yoki `skip_dm_neutral_reply` siyosatiga amal qiladi.

## Komponentlar

| Yo‘l | Vazifa |
|---|---|
| `web/app` | Next.js App Router: marketing, auth, dashboard, accounts, automation builder/history, Inbox, analytics, team, audit, settings |
| `web/components` | App shell, form, charts va reusable UI |
| `web/lib` | API client, types, format helpers |
| `api/cmd/server` | API va worker process entrypoint |
| `api/cmd/migrate` | Schema migration runner |
| `api/internal/httpapi` | Strict JSON, auth/RBAC/CSRF, routes, webhook/OAuth handlers |
| `api/internal/provider` | Meta va test-only mock adapter |
| `api/internal/worker` | Comment-to-DM state machine |
| `api/internal/store` | Tenant-scoped PostgreSQL persistence va durable queue |
| `api/internal/security` | Session/token hashing, AES-256-GCM, webhook signature helpers |
| `api/internal/rules` | Keyword/media matching |
| `api/internal/migrations` | Additive SQL migrations |

## Frontend

- Next.js 16, React 19, TypeScript strict mode.
- Browser faqat application API bilan gaplashadi; Meta access token browserga berilmaydi.
- Automation builder quyidagilarni saqlaydi: account, post scope, keyword/match mode, private reply, uchta public reply, follow toggle, UNKNOWN fallback, active flag va priority.
- Execution history har bir `follow_check`, `private_reply`, `public_reply` natijasini alohida ko‘rsatadi.
- Product UI’da demo, billing va fake account yo‘llari yo‘q.

## Backend

Go `net/http` router method-aware patterns ishlatadi. Handler SQL yozmaydi; barcha persistence `store` orqali o‘tadi. Provider-specific endpoint/payload code `provider` paketida qoladi.

Worker queue modeli:

1. Webhook body HMAC bilan tekshiriladi.
2. Event `webhook_events`ga unique `provider_event_id` bilan yoziladi.
3. Redis mavjud bo‘lsa wake-up signal beradi; source of truth PostgreSQL.
4. Worker row lease oladi va stale lease’ni tiklay oladi.
5. `automation_executions` event uchun yagona execution yaratadi.
6. Har bir external side effect oldidan `automation_execution_actions` marker yaratiladi.
7. Private reply ambiguous bo‘lsa qayta yuborilmaydi. Public reply faqat aniq retryable rejectionda maksimal 3 marta qayta olinadi.

## Database sxemasi

Asosiy jadvallar:

| Jadval | Vazifa |
|---|---|
| `users` | Foydalanuvchi, email verification, preferences |
| `workspaces` | Tenant |
| `workspace_members` | Tenant RBAC |
| `sessions` | Hashed HttpOnly session token binding |
| `one_time_tokens` | Email verification/password reset |
| `oauth_states` | Bir martalik, expiry’li OAuth state |
| `instagram_accounts` | Provider identity, scopes, encrypted token, status |
| `automation_rules` | Match/follow/reply konfiguratsiyasi |
| `webhook_events` | Idempotent durable queue va redacted payload |
| `automation_executions` | Event/rule natijasi va follow status |
| `automation_execution_actions` | Follow/private/public operation ledger |
| `conversations`, `messages` | Inbox va manual reply idempotency |
| `team_invitations` | Workspace takliflari |
| `audit_logs` | Muhim mutation audit izi |

Legacy `plans`, `subscriptions` va `messages.is_demo` ustuni production data/migration tarixini buzmaslik uchun fizik schema’da qoladi. Application ularni mahsulot funksiyasi sifatida o‘qimaydi yoki yozmaydi. Keyingi cleanup faqat alohida, data-safe migration bilan qilinadi.

Migration `005_core_comment_to_dm.sql`:

- eski `reply_text`ni yangi template ustunlariga backfill qiladi;
- follow policy va tri-state status qo‘shadi;
- action ledger yaratadi;
- eski mock rule/accountlarni o‘chirmasdan deaktivatsiya qiladi;
- ommaviy demo login sessiyalari va password hashini bekor qiladi.

## API endpointlar

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

### Workspace va Instagram

- `GET /api/v1/workspaces`
- `POST /api/v1/workspaces/{id}/switch`
- `GET /api/v1/instagram/connect`
- `GET /api/v1/instagram/callback`
- `GET /api/v1/instagram/accounts`
- `DELETE /api/v1/instagram/accounts/{id}`

### Automation

- `GET|POST /api/v1/automations`
- `GET|PATCH|DELETE /api/v1/automations/{id}`
- `GET /api/v1/automations/{id}/executions`

### Meta webhook va Inbox

- `GET /api/v1/webhooks/instagram`
- `POST /api/v1/webhooks/instagram`
- `GET /api/v1/inbox/conversations`
- `GET /api/v1/inbox/conversations/{id}/messages`
- `POST /api/v1/inbox/conversations/{id}/messages`

### Operatsion

- `GET /api/v1/analytics/summary`
- team invitation/member endpointlari
- `GET|PATCH /api/v1/settings`
- `GET /api/v1/audit-logs`
- `GET /api/v1/sessions`
- `DELETE /api/v1/sessions/{id}`
- `POST /api/v1/settings/data-deletion-request`

Billing va mock-event endpointlari mavjud emas.

## Authentication va authorization

- Session raw tokeni HttpOnly cookie’da, hash’i database’da.
- Mutation endpointlar `X-CSRF-Token` talab qiladi.
- Email tasdiqlanmaguncha authenticated app access berilmaydi.
- RBAC: `customer < operator < manager < owner`.
- Account/rule mutationlari manager+, team boshqaruvi owner, Inbox operator+, analytics manager+.
- Workspace switch yangi tenantga tegishli sessiya bindingini tekshiradi.
- Store query’lari `workspace_id` bilan tenantni cheklaydi; integratsion test cross-tenant negative holatlarni qoplaydi.

## Meta integratsiyasi

- `instagram` login: `graph.instagram.com`, Instagram Login OAuth va messaging permissions.
- `unified` login: Facebook Login for Business configuration ID, assigned Instagram account discovery va `subscribed_apps` tasdig‘i.
- `is_user_follow_business` faqat direct Instagram Login, kerakli scope va participant messaging context mavjud bo‘lganda so‘raladi.
- Unified login follow check live tasdiqlanmagani uchun `UNKNOWN` qaytaradi.
- Private reply comment ID orqali rasmiy private-reply endpointga yuboriladi.
- Public reply comment `/{comment-id}/replies` orqali yuboriladi.

## Xavfsizlik chegaralari

- OAuth token AES-256-GCM ciphertext sifatida saqlanadi.
- Meta webhook `X-Hub-Signature-256` tekshiruvisiz qabul qilinmaydi.
- OAuth state hashed, expiry’li va bir martalik.
- Strict JSON decoder 1 MiB; webhook body 2 MiB limit.
- CORS allowlist, security headers, trusted proxy CIDR va auth rate limit bor.
- Secret/raw token yoki to‘liq sensitive provider payload log qilinmaydi.
