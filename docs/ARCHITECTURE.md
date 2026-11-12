# IDS Automate arxitekturasi

Tekshiruv sanasi: 2026-11-12.

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
| `web/app` | Next.js App Router: marketing, auth, `/setup` onboarding, dashboard, accounts, automation builder/history, Inbox, analytics, team, audit, settings |
| `web/components` | App shell, 4-step `setup-wizard`, automation form, charts va reusable UI |
| `web/lib` | API client, types, format helpers |
| `api/cmd/server` | API va worker process entrypoint |
| `api/cmd/migrate` | Schema migration runner |
| `api/internal/httpapi` | Strict JSON, auth/RBAC/CSRF, routes, Google OIDC and Meta OAuth/webhook handlers |
| `api/internal/provider` | Meta va test-only mock adapter |
| `api/internal/worker` | Comment-to-DM state machine |
| `api/internal/store` | Tenant-scoped PostgreSQL persistence va durable queue |
| `api/internal/security` | Session/token hashing, AES-256-GCM, webhook signature helpers |
| `api/internal/rules` | Keyword/media matching |
| `api/internal/migrations` | Additive SQL migrations |

## Frontend

- Next.js 16, React 19, TypeScript strict mode.
- Browser faqat application API bilan gaplashadi; Meta access token browserga berilmaydi.
- Automation builder quyidagilarni saqlaydi: account, post scope, keyword/match mode, private reply, uchta public reply, follow toggle, UNKNOWN fallback, active flag va priority. Tanlangan postlar uchun browser Media ID so‘ramaydi; backend tenantga tegishli encrypted tokenni ochib, Meta `/{ig-user-id}/media` edge’dan maksimal 50 ta post/Reels metadata olib beradi.
- Execution history har bir `follow_check`, `private_reply`, `public_reply` natijasini alohida ko‘rsatadi.
- Product UI’da demo, billing va fake account yo‘llari yo‘q.
- Signed-out `/setup` alohida IDS parolini so‘ramaydi. `GET /auth/instagram/status` holatni oladi, `POST /auth/instagram/start` terms roziligi bilan rasmiy Meta OAuth’ni boshlaydi; callback authenticated HttpOnly session, account va yangi identity uchun workspace yaratadi yoki oldingi IDS-connected account’ga bog‘laydi.
- Instagram login OAuth state DB’da hash holida, browser binding cookie bilan 10 daqiqa amal qiladi va bir marta consume qilinadi. Meta token browserga yuborilmaydi, AES-256-GCM ciphertext sifatida saqlanadi. State/cookie mos kelmasa account yoki session yaratilmaydi.
- OAuth callback URI o‘zgarmaydi. Successful callback account ID bilan `/setup?step=2`ga qaytaradi va post tanlash bosqichini ochadi.
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` public sahifalari `/setup`ga redirect qiladi. Legacy backend auth routelari hamda data saqlovchi schema o‘zgartirilmagan.
- Wizard API’dan qaytgan akkaunt/postlarni ko‘rsatadi; loading/error/empty holatlari mavjud. Qoidani yaratish muvaffaqiyati faqat server automation ID qaytarganidan keyin ko‘rsatiladi.
- Google OIDC backend saqlangan, lekin Google tugmasi public login/register UI’dan olib tashlangan va joriy onboarding oqimida ishlatilmaydi.

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
| `google_oauth_login_states` | Google login intent, nonce/PKCE verifier va remember-me holati; state hash, expiry va one-time consume |
| `oauth_identities` | Verified Google `sub` provider identifikatorini tenant useriga bog‘lash |
| `instagram_oauth_login_states` | Public Instagram login uchun hashed state/browser binding, terms roziligi, session muddati va expiry |
| `instagram_oauth_identities` | Meta Instagram account ID’ni IDS user/workspace’ga bog‘lash va terms qabul vaqtini saqlash |
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

Migration `006_google_oauth.sql` additive ravishda Google login state va identity jadvallarini qo‘shadi. `007_instagram_login.sql` Instagram login state va identity jadvallarini qo‘shadi; legacy ma’lumotni o‘zgartirmaydi yoki o‘chirmaydi.

## API endpointlar

### Public/auth

- `GET /healthz`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/google/status`
- `POST /api/v1/auth/google/start`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/instagram/status`
- `POST /api/v1/auth/instagram/start`
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
- `GET /api/v1/instagram/accounts/{id}/media`
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
- Public onboarding’dagi auth identity — Meta OAuth orqali tasdiqlangan Instagram account ID. State bir martalik va browser-binding cookie’ga bog‘langan; terms roziligi identity mapping’da timestamp bilan saqlanadi. Yangi Instagram identity uchun password bilan login qilinmaydigan synthetic email va random password hash ichki `users` jadvalining NOT NULL sxemasini qondiradi; email UI’ga chiqarilmaydi va verified email deb belgilanmaydi.
- Instagram identity’li user `email_verified_at` talabidan faqat mavjud `instagram_oauth_identities` mapping’i sabab ozod. Session va RBAC/tenant membership tekshiruvi o‘z kuchida qoladi. Account ID boshqa tenantda active bo‘lsa, claim rad etiladi.
- Google login authorization code oqimida bajariladi. Google ID token signature, issuer, audience, expiry, `nonce` va `email_verified` tekshiriladi. Access token saqlanmaydi; Google `sub` va verified email identity link sifatida saqlanadi.
- Login intent mavjud Google identity yoki shu verified email bilan mavjud hisobni bog‘laydi; ro‘yxatdan o‘tish intenti esa yangisiga alohida owner workspace yaratadi. Google signup mavjud hisob bilan email orqali mos kelsa, `oauth_identities` orqali shu hisobga bog‘lanadi.
- OAuth state 10 daqiqaga database’da hash ko‘rinishida saqlanadi, callback’da bir marta ishlatiladi va shu browserga bog‘langan HttpOnly/SameSite=Lax cookie bilan tekshiriladi. PKCE S256 authorization-code almashinuvida ishlaydi; nonce OIDC token ichidan constant-time solishtiriladi.
- Google Client ID/Secret backend environment’da bo‘lmasa status `enabled=false`, OAuth start esa aniq 503 qaytaradi. Google OAuth backend route’lari bor, lekin public login/register UI’da hozir tugma yo‘q.
- Instagram public UI OAuth config qiymatlari borligini tekshiradi; bu Meta credentials qabul qilinganini isbotlamaydi. Haqiqiy token exchange muvaffaqiyatli bo‘lmaguncha login live deb hisoblanmaydi. Legacy email/parol sahifalari `/setup`ga redirect qiladi.
- Unified Login account discovery javobida `account_type` qaytmagani uchun subtype `UNKNOWN` saqlanadi; UI Business/Creator turini taxmin qilib ko‘rsatmaydi.
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

## Automation keyword preview

- `POST /api/v1/automations/match-preview` manager+ session va CSRF token talab qiladi; workspace auth middleware orqali tasdiqlanadi.
- Request: `name`, `text`, `match_mode`, `keywords`, `exclusions`. Ruxsat etilgan match mode qiymatlari `keyword_list`, `contains`, `exact`.
- Handler vaqtinchalik in-memory rule tuzib, worker ishlatadigan `rules.MatchKeyword` va `rules.Normalize` funksiyalarini chaqiradi. Database, provider yoki Meta API side-effecti yo‘q.
- Response original/normalised comment, moslik, topilgan keyword va kutiladigan action nomini qaytaradi. `sends_message` doim `false`.
- `keyword_list` whole-word/whole-phrase chegaralarini qo‘llaydi. Unicode NFKC, case-fold, apostrof variantlari va Uzbek Cyrillic→Latin transliteration ishlatiladi; saqlangan original matn o‘zgarmaydi.
- Worker barcha active mos qoidalarni solishtirib, eng uzun normallashtirilgan keyword’li qoidani oladi. Tenglikda `ActiveRules` query tartibi ustuvorlikni belgilaydi.

## Xavfsizlik chegaralari

- Instagram OAuth access tokenlari AES-256-GCM ciphertext sifatida saqlanadi. Google login access tokeni faqat ID tokenni verifikatsiya qilish oqimida ishlatiladi va persistence qilinmaydi.
- Meta webhook `X-Hub-Signature-256` tekshiruvisiz qabul qilinmaydi.
- OAuth state hashed, expiry’li va bir martalik.
- Google client secret faqat backend environment’da turadi; callback faqat ilovaning belgilangan `/login`, `/register` yoki `/app` route’iga qaytadi, foydalanuvchi yuborgan redirect URL qabul qilinmaydi.
- Strict JSON decoder 1 MiB; webhook body 2 MiB limit.
- CORS allowlist, security headers, trusted proxy CIDR va auth rate limit bor.
- Secret/raw token yoki to‘liq sensitive provider payload log qilinmaydi.

