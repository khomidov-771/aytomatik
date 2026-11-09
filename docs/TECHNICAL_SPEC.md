# IDS Automate — Texnik topshiriq (TZ)

## 1. Mahsulot tavsifi
IDS Automate — Instagram Professional (Business/Creator) akkauntlari uchun comment-to-DM avtomatlashtirish SaaS platformasi. Har bir mijoz saytga ro‘yxatdan o‘tadi, o‘z Instagram akkauntini rasmiy Instagram Login OAuth orqali ulaydi, post/Reels commentlari uchun kalit so‘z qoidalarini yaratadi va ruxsat etilgan holatlarda comment muallifiga Instagram Private Reply yuboradi.

Platforma ko‘p tenantli: bir foydalanuvchi yoki tashkilotning ma'lumotlari boshqasiga ko‘rinmasligi shart.

## 2. Asosiy maqsadlar
- Instagram akkauntlarini xavfsiz ulash va uzish.
- Comment webhooklarini qabul qilish.
- Kalit so‘z bo‘yicha avtomatlashtirish qoidasini topish.
- Meta siyosati ruxsat bergan private reply yuborish.
- Inbox, statistika, audit log va tariflarni boshqarish.
- Keyinchalik agentliklar uchun bir nechta mijoz/akkaunt boshqaruvini qo‘llash.

## 3. Foydalanuvchi rollari
- **Owner:** workspace, billing, barcha akkauntlar va foydalanuvchilarni boshqaradi.
- **Manager:** akkauntlar, qoidalar va analitikani boshqaradi.
- **Operator:** Inbox xabarlarini ko‘radi va ruxsat etilgan amallarni bajaradi.
- **Customer:** o‘z workspace'i doirasidagi sozlamalarni boshqaradi.

RBAC backend'da tekshiriladi. Faqat frontend'da yashirish yetarli emas.

## 4. Dizayn va vizual talablar
Reference: `design/ids-automate-reference.png`.

### 4.1 Vizual til
- Premium dark SaaS dashboard.
- Background: navy/near-black (`#070B18`, `#0B1020`).
- Surface: `#10182B`, `#151F36`.
- Primary: violet/indigo (`#7657FF`, `#8B5CF6`).
- Secondary accent: cyan (`#28C7FA`) faqat status yoki kichik highlightlarda.
- Text primary: `#F5F7FF`; secondary: `#9AA7C0`.
- Border: oq rangning 8–12% opacity.
- Radius: cards 14–18px, inputs 10–12px.
- Font: Inter yoki Manrope.
- Glow juda me'yorida; matn kontrasti WCAG AA ga yaqin bo‘lsin.

### 4.2 Landing page
- Header: IDS Automate logo, Imkoniyatlar, Tariflar, Qo‘llanma, Blog, til tanlash, Kirish.
- Hero: “Instagram biznesingizni avtomatlashtiring”.
- CTA: “Bepul sinab ko‘rish”, “Demo ko‘rish”.
- Feature blocks: commentga avtomatik javob, Direct xabarlar, sotuvni oshirish, analitika.
- Ishonch ko‘rsatkichlari faqat haqiqiy ma'lumot bo‘lsa; demo qiymatlar “Demo” deb belgilanadi.
- Footer: mahsulot, hujjatlar, maxfiylik, shartlar, aloqa.

### 4.3 Auth
- Login: email, password, password visibility, forgot password, Google sign-in optional, register link.
- Register: name, email, password, password confirmation, terms/privacy consent.
- Email verification va password reset flow.
- Login/register form validation, rate limiting, generic auth error messages.
- Social login backend tayyor bo‘lmasa, tugma disabled yoki “Tez orada”; ishlayotgandek ko‘rsatmang.

### 4.4 Dashboard
Sidebar:
- Bosh sahifa
- Instagram akkauntlar
- Avtomatlashtirish
- Inbox (Direct)
- Kampaniyalar
- Analitika
- Jamoa
- Tarif
- Sozlamalar

Topbar:
- Workspace switcher
- Notifications
- Profile menu

Dashboard widgets:
- Jami xabarlar
- Commentlar
- Yuborilgan DM
- Konversiya
- Faollik grafigi
- Oxirgi avtomatlashtirishlar
- Ulangan akkauntlar holati

Barcha statistikalar real backend'dan kelishi kerak; demo rejim alohida belgilanadi.

### 4.5 Instagram akkauntlar
- “Akkaunt ulash” CTA.
- OAuth connect flow.
- Account cards: username, avatar, account type, connection state, last sync.
- Disconnect/reconnect.
- Token status; tokenning o‘zi UI'da hech qachon ko‘rsatilmaydi.
- Bir workspace uchun tarifga bog‘liq account limit.

### 4.6 Automation builder
Rule fields:
- Rule name.
- Instagram account.
- Trigger: comment created.
- Scope: selected media/post yoki all eligible media.
- Match mode: exact / contains / keyword list.
- Keywords: case-insensitive, whitespace-normalized.
- Optional exclusions.
- Reply template.
- Enable/pause toggle.
- Preview of matching behavior.
- Test mode using mock events.

Example:
- Keyword: `NARX`
- Comment: “Narxi qancha?”
- Action: send one allowed private reply with configured text/link.

Rules:
- One event should not trigger duplicate replies.
- Match priority and conflicts must be documented.
- Prevent loops and self-triggering.
- Respect Meta API policy and delivery errors.

### 4.7 Workflow visualization
Simple visual chain:
Comment trigger → Keyword condition → Private reply action → Result/log.
MVP does not need a complex no-code canvas. Make a clear rule editor first.

### 4.8 Inbox
- Conversation list and search.
- Message thread.
- Contact/comment context where API provides it.
- Reply composer only when messaging policy and API allow.
- Status labels, unread/read if supported.
- Empty, loading, failed, and permission-restricted states.

### 4.9 Analytics
- Date range selector.
- Comments received, eligible triggers, replies sent, failures, conversion if user defines conversion event.
- Charts must use backend data.
- Export CSV optional.
- No invented conversion attribution.

### 4.10 Plans and billing
Initial configurable plans (illustrative only):
- Free: 1 account, limited rules/events.
- Starter: 3 accounts.
- Pro: 10 accounts.
- Agency: 50 accounts.
Do not hard-code pricing or promise unlimited messaging. Admin can configure limits.
Payment integration can be deferred; support manual/demo billing state initially.

### 4.11 Settings
- Profile, workspace, team members.
- Language (Uzbek default; RU/EN scaffold).
- Notifications.
- Instagram integrations.
- Webhook status/diagnostics.
- Privacy and data deletion request.
- Security/session management.

## 5. Instagram / Meta API integration
Use the current official **Instagram API with Instagram Login** flow where appropriate for the product. Do not mix endpoints, token types, permissions, or hostnames from Facebook Login and Instagram Login flows.

Permissions to evaluate against current Meta docs:
- `instagram_business_basic`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`

Only request scopes actually needed. Confirm exact current names, eligibility, API version, endpoints, and review requirements from Meta's official documentation before implementation.

### 5.1 OAuth
- “Connect Instagram” starts server-generated authorization URL.
- Use secure `state` (CSRF protection), short-lived, one-time.
- Callback validates state, exchanges code server-side, fetches account identity, stores encrypted token.
- Store token metadata: scopes, expiry, account ID, connected_by, status.
- Handle denied permissions and reconnect.
- Never collect Instagram password.
- Redirect URI must exactly match Meta app configuration.

### 5.2 Webhooks
- GET verification endpoint handles Meta `hub.mode`, `hub.verify_token`, `hub.challenge`.
- POST endpoint validates signature according to current Meta guidance.
- Subscribe only required fields (especially comments and messaging events where available for the chosen login configuration).
- Acknowledge quickly; persist event and enqueue processing.
- Idempotency key prevents duplicate handling.
- Store raw event only if necessary and with retention policy; redact personal data from logs.

### 5.3 Comment-to-private-reply behavior
- Detect eligible comment event.
- Resolve connected Instagram account and matching active rule.
- Check eligibility, media ownership, reply window/limits and current Meta policy.
- Send at most the allowed private reply through the correct official endpoint.
- Record status: queued, sent, failed, skipped_policy, duplicate, permission_error.
- Never retry permanent errors blindly.
- Do not send unsolicited repeated messages.
- Clearly tell user when event cannot be replied to because of Meta limitations.

### 5.4 Mock mode
- Provide `INSTAGRAM_PROVIDER=mock|meta`.
- Mock mode simulates OAuth, webhook events, and reply outcomes for UI development.
- UI must show “Demo mode”; mock success must never be confused with real delivery.

## 6. Backend architecture
Suggested Go modules:
- `auth`
- `workspaces`
- `members`
- `instagram`
- `oauth`
- `webhooks`
- `automations`
- `inbox`
- `analytics`
- `billing`
- `audit`
- `notifications`

Suggested REST endpoints (adapt to existing code conventions):
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/me`
- `GET /api/v1/workspaces`
- `GET /api/v1/instagram/connect`
- `GET /api/v1/instagram/callback`
- `GET /api/v1/instagram/accounts`
- `DELETE /api/v1/instagram/accounts/:id`
- `GET /api/v1/automations`
- `POST /api/v1/automations`
- `GET /api/v1/automations/:id`
- `PATCH /api/v1/automations/:id`
- `DELETE /api/v1/automations/:id`
- `POST /api/v1/webhooks/instagram` (GET verify + POST events)
- `GET /api/v1/inbox/conversations`
- `GET /api/v1/inbox/conversations/:id/messages`
- `POST /api/v1/inbox/conversations/:id/messages` (only if supported)
- `GET /api/v1/analytics/summary`
- `GET /api/v1/billing/plan`
- `GET /api/v1/settings`

## 7. Database model (minimum)
- `users`: id, name, email, password_hash, email_verified_at, created_at.
- `workspaces`: id, name, owner_user_id, plan_id, created_at.
- `workspace_members`: workspace_id, user_id, role.
- `instagram_accounts`: id, workspace_id, instagram_user_id, username, account_type, token_ciphertext, token_expires_at, scopes, status, connected_at.
- `automation_rules`: id, workspace_id, instagram_account_id, name, trigger_type, match_mode, keywords, media_scope, reply_text, is_active, created_at, updated_at.
- `webhook_events`: id, provider_event_id, workspace_id, event_type, payload_redacted, processing_status, received_at, processed_at.
- `automation_executions`: id, workspace_id, rule_id, event_id, status, provider_message_id, error_code, created_at.
- `conversations`: id, workspace_id, instagram_account_id, participant_id, participant_username, last_message_at.
- `messages`: id, conversation_id, provider_message_id, direction, message_text, status, created_at.
- `audit_logs`: id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_redacted, created_at.
- `plans`: id, name, account_limit, rule_limit, event_limit, price, is_active.
- `subscriptions`: id, workspace_id, plan_id, status, current_period_start, current_period_end.

Use UUIDs, foreign keys, indexes, unique constraints and migrations. Enforce tenant ownership in every repository/service query.

## 8. Security and privacy
- Hash passwords with Argon2id or bcrypt using appropriate parameters.
- Secure, HttpOnly, SameSite cookies for browser sessions where practical.
- CSRF protection for cookie-authenticated mutations.
- Encrypt OAuth tokens at rest using a managed key or environment-provided encryption key.
- Secrets only in environment/secret manager.
- Rate limit login, password reset and sensitive endpoints.
- Validate OAuth state and webhook signatures.
- Audit connect/disconnect, rule changes, role changes, exports and deletion requests.
- Provide account disconnect and data deletion workflows.
- Define retention policy; minimize stored message/comment content.
- Do not log access tokens, secrets, passwords, full sensitive payloads.

## 9. Non-functional requirements
- Responsive: 360px mobile, 768px tablet, 1440px desktop.
- Accessible keyboard focus, labels, contrast.
- API errors consistent JSON structure.
- Pagination for lists.
- Structured logs and health checks.
- Docker Compose local environment.
- DB migrations and seed demo workspace.
- Unit/integration tests.
- Basic observability for webhook queue depth and failures.

## 10. Acceptance criteria
1. Visitor can register, verify email (dev mail mode acceptable), log in and log out.
2. User receives a workspace and is isolated from other tenants.
3. User can start Instagram OAuth; mock mode can complete locally.
4. Real mode refuses to pretend connection if credentials/scopes are absent.
5. Connected account list shows safe metadata only.
6. User can create, edit, pause and delete automation rules.
7. Test webhook event triggers the matching rule once only.
8. Mock reply is clearly labeled as demo.
9. Real private reply is sent only after eligibility/policy checks and a successful official API response.
10. Dashboard metrics derive from stored execution/event data.
11. Token never appears in frontend, logs, or API responses.
12. Role checks and tenant isolation have automated tests.
13. Mobile and desktop UI are usable.
14. Setup instructions and `.env.example` are complete.

## 11. Out of scope for MVP
- Scraping Instagram or controlling browser sessions.
- Collecting customer Instagram passwords.
- Bulk unsolicited messaging.
- AI-generated replies without explicit user configuration and policy checks.
- Complex visual flow editor.
- Fully automated subscription billing until payment provider and legal requirements are confirmed.
