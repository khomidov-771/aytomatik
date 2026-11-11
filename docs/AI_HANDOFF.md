# AI handoff

Yangilangan: 2026-11-12.

## Birinchi o‘qiladigan fayllar

1. `AGENTS.md`
2. `README.md`
3. `docs/TECHNICAL_SPEC.md`
4. `docs/ARCHITECTURE.md`
5. `docs/PROJECT_STATUS.md`
6. `docs/NEXT_STEPS.md`
7. `.codex/skills/ids-automate/SKILL.md`

## Mahsulot konteksti

IDS Automate endi umumiy SaaS suite emas. Core product:

```text
REAL COMMENT → KEYWORD MATCH → OPTIONAL FOLLOW CHECK → PRIVATE REPLY → PUBLIC COMMENT REPLY
```

Subscription/payment scope olib tashlangan. Productda demo mode, demo credential, mock lab, fake account va fake analytics bo‘lmasligi kerak.

## Hozirgacha bajarilgan ish

- Migration `005_core_comment_to_dm.sql` qo‘shildi.
- Automation rule’ga private/public template’lar, follow toggle va UNKNOWN fallback qo‘shildi.
- `FOLLOWER`, `NOT_FOLLOWER`, `UNKNOWN` tri-state implementatsiya qilindi.
- Direct Instagram Login uchun `is_user_follow_business` controlled API implementation qo‘shildi.
- Unified/Facebook Login follow check ataylab `UNKNOWN`; live support da’vo qilinmaydi.
- Meta public comment reply adapteri qo‘shildi.
- Worker private reply muvaffaqiyatini kutib, keyin public success reply yuboradigan state machine’ga o‘tkazildi.
- Not-follower va UNKNOWN fallback branchlari ajratildi.
- `automation_execution_actions` ledger follow/private/public natijalarni alohida saqlaydi.
- Private reply duplicate/ambiguous retry fail-closed. Public reply faqat aniq retryable failureda max 3 urinish.
- Execution history API va UI qo‘shildi.
- Billing/campaign/mock-lab sahifalari va API route’lari olib tashlandi.
- Demo login autofill, demo badge, mock event form va demo credentials olib tashlandi.
- Legacy mock account/rulelar migration bilan data yo‘qotmasdan deaktivatsiya qilinadi.
- Seed command olib tashlandi; API Dockerfile faqat server quradi.
- Landing/dashboard/analytics faqat core product va database natijasini ko‘rsatadi.
- Public, auth va workspace UI professional light-first uslubga yangilandi; deep-navy sidebar saqlandi.
- Workspace bo‘ylab shrift, spacing, card, form, Inbox, builder va responsive o‘lchamlar o‘qiladigan professional scale’ga ko‘tarildi.
- Dashboardga real `connected accounts` va `active automations` holatidan hisoblanadigan 3 bosqichli onboarding hero qo‘shildi; bo‘sh chart fake nuqtalar bilan to‘ldirilmaydi.
- Til, workspace, analytics oralig‘i, account/fallback va team role tanlovlari `web/components/select-menu.tsx` orqali bir xil light/dark custom dropdown ishlatadi; native browser menu’ni qaytarmang.
- `web/components/motion-reveal.tsx` landing scroll-reveal’ni IntersectionObserver bilan boshqaradi; umumiy micro-interaction va reduced-motion guardlari `web/app/globals.css` oxiridagi motion system qatlamida.
- `web/components/preferences-provider.tsx` UZ/RU/EN tanlovi, light/dark tema va browser persistence’ni boshqaradi.
- Landing, legal, auth va barcha asosiy app modullari uch tilli matnlarga ulandi.
- Google sign-in uchun server-side OAuth 2.0/OIDC authorization-code oqimi qo‘shildi (`api/internal/httpapi/google_oauth.go`); code, access token yoki client secret browserga berilmaydi.
- Google ID token signature/issuer/audience/expiry/nonce/email_verified tekshirilib, `oauth_identities` jadvalida provider `sub` bog‘lanadi.
- Google signup alohida owner workspace yaratadi; login intent yangi account ochmaydi. Verified email bilan mavjud local user xavfsiz link qilinadi.
- OAuth state hashed/10-minute/one-time; PKCE S256, HttpOnly SameSite=Lax browser cookie va `Origin` allowlist tekshiruvi bilan login-CSRF/code interception himoyasi qo‘shildi.
- Google credentials bo‘lmasa status `enabled=false` va UI aniq sozlanmagan holatni ko‘rsatadi. Migration `006_google_oauth.sql` additive.
- OAuth callback’ning fake RSA issuer va disposable PostgreSQL bilan controlled E2E integration testi bor; bu live Google acceptance emas.
- Public landing hero dark-violet ko‘rinishga yangilandi; telefon UI — faqat oqim illustratsiyasi, analytics/account data emas.
- Public Boshlash flow endi `/setup`dagi Instagram OAuth bilan boshlanadi; undan oldingi email/parol onboarding tarixi pastda, 2026-11-12 patch bo‘limi joriy holat sifatida qaralsin.
- `web/components/setup-wizard.tsx` real API’lar bilan 4 qadamli account → post → settings → create onboarding beradi; yangi endpoint/schema yo‘q.
- `web/app/app/accounts/page.tsx` successful OAuth return’dan keyin account ID bilan wizard step 2’ni davom ettiradi. Meta callback URL/handler o‘zgarmagan.
- Google OAuth tugmalari public login/register’dan olib tashlangan. Backend OIDC/migration kodlari saqlanadi; `google-auth-button.tsx` hozir bu sahifalarda ulanmagan.
- Unified Login `assigned_instagram_accounts` subtype bermagani uchun yangi row’da account type `UNKNOWN`, UI esa Meta’dan subtype qaytmaganini ko‘rsatadi.

## Arxitektura qarorlari

1. PostgreSQL source of truth va durable queue; Redis wake-up signal xolos.
2. Har external side effect oldidan committed action marker.
3. Private reply noaniq outcome’da qayta yuborilmaydi.
4. Public “DM yuborildi” matni private action `succeeded` bo‘lmaguncha yuborilmaydi.
5. Private success/public failure alohida yoziladi va faqat public action safe retry qilinadi.
6. Follow missing field/error/rate limit/network = `UNKNOWN`, hech qachon `NOT_FOLLOWER` emas.
7. Comment mavjudligi profile/follow permission mavjudligini anglatmaydi.
8. Provider-specific kod `api/internal/provider` ichida.
9. Tenant isolation store signature va SQL’da `workspace_id` bilan majburiy.
10. Legacy billing schema production data xavfsizligi uchun hozircha saqlanadi, lekin application ishlatmaydi.
11. Google OIDC tekshiruvi `api/internal/httpapi/google_oauth.go`da; faqat server environment’da `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, callback URI. Access token persistence yo‘q.

## Qayta yozmang

- Auth/session/CSRF/RBAC bazasini.
- OAuth state bir martalik oqimini.
- AES-256-GCM token encryptionni.
- PostgreSQL durable queue/lease recoveryni.
- Action-ledger idempotency modelini.
- Tri-state follow semanticsni.
- Existing migrationsni; yangi schema uchun yangi migration yozing.
- Google OAuth/OIDC state, browser binding, verified claims va one-time callback semanticsni.

## Muhim fayllar

- `api/internal/worker/worker.go` — core state machine
- `api/internal/provider/provider.go` — Meta login/follow/private/public/message API
- `api/internal/store/store.go` — rules, queue, action ledger, history, Inbox
- `api/internal/migrations/005_core_comment_to_dm.sql` — additive data-preserving schema
- `api/internal/httpapi/google_oauth.go` — server-side Google OAuth/OIDC start va callback
- `api/internal/migrations/006_google_oauth.sql` — login state va OAuth identity schema
- `web/components/google-auth-button.tsx` — saqlangan, lekin public login/register’da hozir ishlatilmaydi
- `api/internal/httpapi/instagram.go` — OAuth/webhook
- `web/components/automation-form.tsx` — builder va execution history
- `web/components/preferences-provider.tsx` — locale/theme state va umumiy controls
- `web/components/setup-wizard.tsx`, `web/app/setup/page.tsx` — 4-step real onboarding
- `web/app/globals.css` — light/dark professional design token va override’lar
- `web/app/app/page.tsx` — real statusga asoslangan dashboard onboarding va empty analytics holati
- `web/app/app/accounts/page.tsx` — login mode/capability warning

## 2026-11-10 soddalashtirilgan Instagram UX

- Accounts sahifasi real OAuth’ni “Instagram bilan kirish” deb aniq ko‘rsatadi, Professional account va official Instagram/Meta oynasi ekanini tushuntiradi; parol IDS Automate’ga kelmaydi.
- Automation builderdagi raw `Media ID` input olib tashlandi.
- `GET /api/v1/instagram/accounts/{id}/media` tenant-scoped encrypted token orqali official Meta media edge’dan so‘nggi 50 post/Reels metadata oladi.
- Builder thumbnail, caption, turi va sana bilan vizual multi-select beradi; “barcha postlar” kelajakdagi postlarni ham qamrab oladi.
- Provider host/path/bearer/fields controlled testdan o‘tgan. Production’da valid Meta credential va real connected account yo‘qligi sabab live media list hali tekshirilmagan.

## Tekshirilgan testlar

2026-11-10:

- `go test ./...` — PASS
- `go vet ./...` — PASS
- `go build ./cmd/server ./cmd/migrate` — PASS
- PostgreSQL integration `TestTenantTokensInboxAndQueue`, `TestGoogleLoginStateAndIdentityLinking` — PASS
- Controlled OIDC integration `TestGoogleOAuthCallbackControlledProvider` — PASS (Google service emas)
- `npm run lint:web` — PASS
- `npm run test:web` — PASS, 2/2
- `npm run build:web` — PASS, 21 route

PostgreSQL integration Windowsda embedded PostgreSQL 18.6.1 processiga qarshi o‘tdi. Docker CLI mavjud emas edi.

## Live tekshirilmagan

- Meta OAuth real browser consent va App Review.
- Real access token exchange/expiry/revoke.
- Real signed webhook payload.
- Real `is_user_follow_business` follower/non-follower/unknown.
- Real private reply delivery va one-reply/time-window response.
- Real public comment reply va private-success/public-failure recovery.
- Real inbound DM/manual send.
- Real Google Cloud consent, client credentials bilan live Google signup/login va production callback.

Controlled tests live dalil emas.

## 2026-11-10 production auditi

Production server va public HTTPS ishlaydi, ammo active Meta credential Meta Graph tomonidan `OAuthException` code `190` bilan rad etildi. Database’da faqat tokeni yo‘q `disconnected` eski mock account bor; active rules, webhook events va executions yo‘q. `Config.MetaConfigurationReady()` qo‘shilib, placeholder credential endi UI/health’da configured deb ko‘rsatilmaydi. Keyingi agent valid App Secretni faqat server environment orqali qabul qilib, keyin real OAuth va live acceptance bajarishi kerak.

## 2026-11-11 Google OAuth production state

- Kod GitHub `main` branchga push qilinib, server `/opt/ids-automate` repo’siga `8c15cde` commitida deploy qilindi.
- Public site va `/healthz`: HTTP 200. API, web va PostgreSQL konteynerlari ishlaydi. Database `schema_migrations` ichida `006_google_oauth.sql` bor.
- `GET /api/v1/auth/google/status`: HTTP 200, `enabled=false`; Google credentialsiz `POST /api/v1/auth/google/start`: HTTP 503. `.env.production`da Google Client ID/Secret yo‘q, shuning uchun live Google login hali yoqilmagan.
- Deployning ilk urinishida Compose `.env.production` env faylisiz ishga tushgani sabab API bo‘sh DB ulanish parametrlarida restart loopga tushdi. PostgreSQL konteyneri restart qilinmadi. To‘g‘ri `--env-file .env.production` bilan API qayta yaratildi, keyin `/healthz` va status endpointlari `200` bo‘ldi.
- Server repo’dagi `.env.production`, compose va boshqa untracked operator fayllari saqlandi; ularni hech qachon tozalama yoki tracked nusxa bilan ustidan yozma.
- Google Cloud OAuth Client ID/Secretni serverga xavfsiz kiritib, `.env.production` bilan API’ni qayta yaratish va real consent/signup/login acceptance qilish kerak. Client Secretni Git/chat/logga kiritma.
- Avvalgi Meta Graph credential tekshiruvi OAuth code `190` qaytargan; bu deployda secret bilan qayta tekshirilmagan. Health/config flag live Graph API dalili emas.

## 2026-11-11 Onboarding redesign quality gate

- `npm run lint:web` — PASS, lint warning/error yo‘q.
- `npm run test:web` — PASS, 1 file / 2 tests.
- `npm run build:web` — PASS, Next.js 22 routes. Restricted Windows worker first returned `EPERM`; normal process permission bilan ayni production build muvaffaqiyatli bo‘ldi.
- Standalone server smoke: `/`, `/setup`, `/login?next=/setup`, `/register?next=/setup`, `/verify-email?next=/setup`, `/app/automations` — HTTP 200; `/setup` loading HTML bor; login/register’da Google sign-in marker va setup’da demo marker yo‘q.
- `go test ./...`, `go vet ./...`, `go build ./cmd/server ./cmd/migrate` — PASS.
- `go test -tags=integration -v ./internal/store` — PASS; embedded disposable PostgreSQL’da Google identity va tenant/store integration testlari o‘tdi.
- Docker CLI yo‘q, shuning uchun Docker containerli integration test yo‘q. Cheklangan worker embedded Postgres executable’ni ishga tushira olmadi; normal process permission bilan test muvaffaqiyatli bo‘ldi.
- Real Meta acceptance qilinmadi: avvalgi production App Secret tekshiruvi Graph API code `190` qaytargan. Playwright E2E ham local full API/database stack bo‘lmagani uchun bu pass’da ishga tushirilmadi.
- Meta subtype, webhook, follower result va delivery faqat live eligible account bilan isbotlanadi. Hozir ularning hech biri bu UI pass’da live tekshirilmagan.

## Qayerdan davom etish

e90505a commit GitHub main’ga push qilinib, production’da faqat web service sifatida deploy qilindi. Home, /setup, login, register va /healthz HTTP 200; API running, PostgreSQL healthy. Production .env.production, API, database, nginx, main checkout va undagi operator files saqlandi. Deploy paytida server main checkout’ida tracked API edits borligi sabab yangi commit alohida detached worktree’dan build qilindi.

Birinchi navbatdagi topshiriq — serverga valid Meta App credentialsni xavfsiz kiritib, test roli berilgan eligible Instagram Professional account bilan Meta live acceptance. OAuth, account/media tanlash, automation saqlash, comment webhook, follower state, private reply va public reply’ni haqiqiy event bilan tekshiring; docs/NEXT_STEPS.md’dagi outcome matrix’ga amal qiling. Oldingi App Secret Graph API code 190 bilan rad etilgan, shuning uchun bugungi web deploy Meta integration ishlashining dalili emas. Secretni chat, Git yoki logga yozmang. Google OAuth credential taskini faqat foydalanuvchi public Google login’ni alohida qaytarmoqchi bo‘lsa ko‘rib chiqing.
## Guardrail

- Scraping/private API yo‘q.
- Mock product mode’ni qaytarmang.
- Billing scope’ni qaytarmang.
- Secret/tokenni commit/log/UI qilmang.
- Google callback’da state cookie, database one-time state, OIDC nonce, signature va verified email talabini olib tashlamang.
- Real test bo‘lmasa “Meta integration ishlaydi” deb yozmang.
- Private failureda public success reply yubormang.
- Unknown follow statusni non-follower deb ko‘rsatmang.

## 2026-11-12 production web deploy

- GitHub main commit: e90505a; only web was rebuilt/recreated.
- Server main checkout had local API edits and untracked operator configuration. It was not pulled, reset, cleaned, or overwritten.
- A detached worktree from origin/main supplied the web build context. Compose used the existing ids-automate project and --no-deps; database/API/nginx were not targeted.
- Public home, /setup, login, register, and /healthz returned HTTP 200 after deploy. Compose reported API running, PostgreSQL running/healthy, web running.
- Meta live acceptance remains blocked by the previously rejected App Secret and unavailable real eligible test account. Do not mark OAuth/webhook/follow/DM live-ready based on this deployment.

- Cleanup completed: verified the temporary .env.production symlink target, unlinked only that link, removed /tmp/ids-automate-web-e90505a, then confirmed the original production env exists and git worktree list contains only /opt/ids-automate.

## 2026-11-12 current work — Instagram OAuth-only onboarding (unverified)

### User intent

Foydalanuvchi public saytda IDS email/parol login ko‘rmasdan `/setup`ga kirishi, o‘z Instagramini rasmiy Meta oynasida ulashi, post/video tanlashi, keywords/templates/follow policy sozlashi va avtomatlashtirishni saqlashi kerak. Bu anonymous protected app emas: Instagram OAuth identity’ni tasdiqlaydi, keyin HttpOnly session va workspace RBAC ishlaydi.

### Current code changes

- `GET /api/v1/auth/instagram/status` Meta OAuth urinishiga konfiguratsiya bor-yo‘qligini bildiradi; `POST /api/v1/auth/instagram/start` `Origin`, terms consent, state hash, browser-binding cookie, rate limit va official Meta authorization URL’ni ishlatadi.
- Mavjud `GET /api/v1/instagram/callback` `idsi.` state prefix bilan public login callback’ni legacy signed-in connect flow’dan ajratadi; redirect URI o‘zgartirilmadi.
- Public callback state’ni bir marta consume qiladi, code exchange bajaradi, Meta tokenni AES-256-GCM bilan shifrlaydi, Instagram ID’ni identity/workspace’ga map qiladi, session yaratadi, `/setup?step=2&account=<uuid>`ga yo‘naltiradi.
- `007_instagram_login.sql` ikkita additive jadval yaratadi: login state va Instagram identity. Meta account oldindan active workspace’da bo‘lsa `connected_by` user va o‘sha workspace saqlanadi; boshqa workspace’ga claim ko‘chirilmaydi. Yangi account uchun alohida owner workspace yaratiladi.
- Synthetic `.invalid` email va random hash DB `users.email/password_hash NOT NULL` cheklovini qoplaydi. Email foydalanuvchiga ko‘rsatilmaydi, `email_verified_at` fake to‘ldirilmaydi, session access Instagram identity mapping bilan aniqlanadi.
- Signed-out setup’da login/password forma o‘rniga UZ/RU/EN Instagram OAuth UX, terms/privacy checkbox, config/error holatlari va Instagram callback’dan keyin media picker’ga davom etish bor.
- `/`, header CTA’lar `/setup`ga ketadi. `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` frontend sahifalari `/setup`ga redirect qiladi. Legacy auth backend/data o‘chirilmadi.
- Settings UI’da Instagram-auth user uchun synthetic email yashirilib, login usuli ko‘rsatiladi.

### Verification status at initial onboarding checkpoint (historical)

- Foydalanuvchining aniq ko‘rsatmasi bilan yangi patch’dan keyin test, lint, build, migration apply yoki browser/live Meta flow bajarilmadi. Hamma yangi kod va SQL **UNVERIFIED**; feature done emas.
- Production Meta App Secret oldin Graph API’da `OAuthException` code `190` bilan rad etilgan. OAuth status value `enabled` faqat credentials format/boshlashga yaroqli ko‘rinishini bildiradi, haqiqiy Meta acceptance emas. Valid secrets va eligible account bo‘lmasa live sign-in ham, Comment-to-DM ham bloklangan.
- Migration 007 production DB’ga qo‘llanmagan. API deploy ham qilinmagan. Hozirgi patch faqat local working tree’da.

### Next task for incoming agent

Avvalo diff’ni audit qiling va `gofmt`ni tugating; keyin foydalanuvchi ruxsat bergach Go compile/unit, frontend lint/build, disposable PostgreSQL migration/integration hamda OAuth state/cookie/replay/tenant mapping negative coverage qo‘shib ishlating. Hamma code-level gate o‘tgandan keyin valid Meta App credentials va eligible test account bilan live OAuth acceptance qiling. Existing production operator checkout yoki `.env.production`ni overwrite/reset qilmang.

## 2026-11-12 — Meta OAuth readiness validator repair

- Production API’da `/healthz` `meta_configured=true`, ammo `GET /api/v1/auth/instagram/status` `api_ready=true`, `enabled=false` qaytardi.
- `.env.production` va running API container’dagi Meta sozlamalari mos; Unified Login mode, Meta bergan Configuration ID va production callback URI to‘g‘ri. Joriy App ID/Secret juftligi Meta credential probe’dan o‘tdi; access token javobi chiqarilmadi yoki saqlanmadi.
- Root cause: `MetaOAuthReady()` Google OAuth callback uchun yozilgan `isAbsoluteURL()` helperini chaqirgan; u faqat `/api/v1/auth/google/callback` path’ini qabul qilgan. `isMetaOAuthRedirectURL()` alohida helper qo‘shilib, production HTTPS va `/api/v1/instagram/callback` path’ini tekshiradi.
- `go test ./...`, `go vet ./...` va `go build ./cmd/server ./cmd/migrate` lokalda PASS. Hali bu yozuv qo‘shilayotgan vaqtda production API deploy qilinmagan; keyin deploy qilinganda API image’ni oldindan taglab rollback yo‘lini saqlang va faqat `api` servisini yangilang.
- Meta OAuth user consent va account discovery end-to-end hali talab qilinadi. `assigned_instagram_accounts` uchun Graph API edge kodda bor; bo‘sh ro‘yxat chiqsa foydalanuvchi Meta oynasida akkauntni share qilganini va professional asset/config ownership’ni tekshiring. Yangi live login bo‘lmaguncha real DM/webhook ishlaydi deb da’vo qilmang.

## 2026-11-12 — production deploy follow-up

- Commit `f0b7ce2` faqat API image’da deploy qilindi; oldingi API image rollback uchun `ids-automate-api:backup-meta-readiness-20261111T203045Z` nomi bilan saqlandi.
- `/healthz` `status=ok`; ichki va public `/api/v1/auth/instagram/status` `api_ready=true`, `enabled=true`, `login_mode=unified`. PostgreSQL healthy; web, database volume, `.env.production`, Nginx va operator checkout o‘zgarmadi. Migration qo‘llanmadi.
- Hozir foydalanuvchi `/setup` orqali Meta consent berishi kerak. Bu bo‘lmaguncha OAuth code exchange, Instagram asset discovery, webhook, private reply va public reply **NOT TESTED LIVE**.

## 2026-11-12 — Joriy OAuth xato handoff

### Audit holati

- Production screenshot signed-in `/app/accounts`da `oauth_exchange_failed` ko‘rsatgan. Bu legacy account-connect callback yo‘li. Eski backend stage/status loglamagani sabab token exchange, asset discovery, webhook subscription yoki response parsing xatosi ekanini screenshotdan ajratib bo‘lmaydi.
- Production read-only holati: `/healthz` HTTP 200 (`meta_configured=true`); `/api/v1/auth/instagram/status` `api_ready=true`, `enabled=true`, `login_mode=unified`, `provider=meta`; `/app/accounts` HTTP 200. `enabled=true` consent va API acceptance emas.
- Yangi production preflight: running API config’i `META_LOGIN_MODE=unified`, Meta Configuration ID `2331645327602552`, redirect URI `https://instagram.schat.uz/api/v1/instagram/callback` (Meta dashboard screenshot bilan mos). `POST /api/v1/auth/instagram/start` same-origin va `accept_terms=false` bilan HTTP 422 `terms_required` qaytardi; source handler state row yaratishdan avval aynan shu guard’da to‘xtaydi. Bu provider OAuth URL’ni Meta’ga yubormaydi va Meta tomondagi configni tekshirmaydi.
- Oxirgi 24 soat production API logida yangi `Instagram login OAuth exchange failed` hodisasi yo‘q. `/setup` sahifasida Terms checkbox belgilanmagani sabab Meta tugmasi disabled; foydalanuvchi consent flow’ni hali boshlamagan.
- Lokal patch `provider.go`da stage/status/code’ni xavfsiz ajratadi. Bo‘sh token, invalid JSON, asset identity yo‘qligi, no/multiple asset va webhook `success=false` holatlari ajratildi; callback bo‘sh ID/token saqlamaydi. UI UZ/RU/EN bosqich yo‘riqlarini ko‘rsatadi.
- `d5c1678` release production API va web image’lariga chiqarildi. API va web alohida qayta yaratildi; rollback uchun `ids-automate-api:backup-oauth-diagnostics-20261112` va `ids-automate-web:backup-oauth-diagnostics-20261112` taglari saqlandi. Health, OAuth status, `/`, `/setup`, va account xato sahifasi HTTP 200; static JS stage-specific xato kodlarini o‘z ichiga oladi.
- PostgreSQL container uptime o‘zgarmadi, migration ishlatilmadi. Production `.env.production`, Nginx, `/opt/ids-automate` checkout va undagi operator dirty/untracked fayllar saqlandi. Build alohida detached release worktree’da qilinib so‘ng olib tashlandi. Serverning root checkout’i production’da deploy qilingan commit bilan aynan teng deb taxmin qilmang.
- Screenshot’dagi callback xatosining eski aniq bosqichi noma’lum. Yangi patch bilan kelajakdagi callback stage/status’ni secretsiz log qiladi, lekin bu callback’ni hozircha real Meta consent orqali qayta bosib ko‘rishmagan.

### Joriy local o‘zgarishlar va dalillar

- API: `api/internal/provider/provider.go`, `api/internal/provider/provider_test.go`, `api/internal/httpapi/instagram.go`, yangi `api/internal/httpapi/instagram_oauth_test.go`.
- UI: `web/app/app/accounts/page.tsx`, `web/components/setup-wizard.tsx`. Oldingi dizayn patch’lari `web/app/globals.css` va `web/components/automation-form.tsx`ni ham o‘zgartirgan; saqlang.
- Docs: `README.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_STEPS.md`, shu `AI_HANDOFF.md`.
- PASS: `go test ./...`; `go vet ./...`; `go build ./cmd/server ./cmd/migrate`; frontend lint; 2/2 Vitest; 22-route Next production build; embedded PostgreSQL integration; `git diff --check`. Windows sandbox child-process/file-write cheklovlari sabab build va integration command’lari qo‘shimcha ruxsat bilan bajarildi.
- Instagram paroli, Meta token yoki Meta secret ishlatilmadi; source/docs’ga secret yozilmadi.

### Birinchi davom topshirig‘i

1. Foydalanuvchi production site’ni yangilab, Instagram Accounts/Setup sahifasidagi Meta tugmasini bosadi; rasmiy Meta oynasida asset va ruxsatlarni o‘zi ko‘rib tasdiqlaydi. Instagram login/parolni so‘ramang, qabul qilmang yoki saqlamang.
2. Meta callback’dan keyin secretsiz stage/status/numeric code loglarini o‘qing. Callback muvaffaqiyatli bo‘lsa, DB’da hisoblangan Professional account ID/username va token encryption-at-rest holatini faqat metadata bilan tasdiqlang; tokenni chiqarib ko‘rmang.
3. So‘ng real media ro‘yxati, webhook subscription/test delivery, real test comment, keyword matching, bitta private reply natijasi va faqat private success’dan keyingi public reply’ni provider response IDs/execution history bilan live tekshiring.
4. Faqat callback va real acceptance dalillari o‘tgach, `PROJECT_STATUS.md` va `NEXT_STEPS.md`ni yangilang. Hozirgi smoke/build/test natijalari tashqi Meta acceptance emas; integratsiyani tayyor deb belgilamang.

## 2026-11-12 — Meta roziligidan keyingi live OAuth urinishlari

- Foydalanuvchi official Meta consent ekranidagi ruxsatlarni o‘zi tasdiqladi va xato bilan qaytdi.
- Production logda ikki callback `failure_reason=instagram_asset_not_shared`; eski `provider.ErrorCode` mapping sabab `error_code=provider_error` ko‘ringan.
- Kod yo‘li bo‘yicha OAuth code/token exchange bosqichidan o‘tib, `GET /me/assigned_instagram_accounts` HTTP success bilan bo‘sh `data` qaytargan. Bu inference’ni faqat kod oqimi qo‘llab-quvvatlaydi; token yoki Meta xom javobi saqlanmagan.
- Account discovery bo‘sh bo‘lgani sabab access token encryption/storage, Instagram account row va `subscribed_apps` bajarilmagan. Ulanish mavjud emas. Webhook/DM/public reply live holati tekshirilmagan.
- Local patch `provider.go`da empty/multiple asset uchun alohida safe diagnostic code qo‘shadi; request `fields=id,username`ga qisqartirilgan. Provider regression test bo‘sh asset’da account/token qaytmasligini va subscription’ga o‘tmasligini tekshiradi. Accounts/setup UI UZ/RU/EN’da 0-result checklist ko‘rsatadi.
- Code checks (2026-11-12) PASS: `go test ./...`, `go vet ./...`, `go build ./cmd/server ./cmd/migrate`, `npm run lint:web`, `npm run test:web` (2/2), `npm run build:web` (22 routes), `git diff --check`. Birinchi web build Windows EPERM sabab standalone output yozolmadi; normal file permission bilan qayta build PASS.
- At handoff moment, these newest local changes are not pushed or deployed. Push/deploy authorization was given earlier in conversation; deploy must preserve production `.env.production`, PostgreSQL data/volume, Nginx, and operator working tree, and retain prior image tags for rollback.

### Davom etish tartibi

1. `git status` va diff’ni qayta ko‘rib, faqat hozirgi patch/docs’ni commit qiling; `main`ga push qiling.
2. Production’ga `.env.production` bilan `docker-compose.ids.yml`dan API/web image’larini deploy qiling; database/migration kerak emas. Health, OAuth status va UI’dagi xato tarjimasini tekshiring.
3. User’dan Business/Creator status, Meta consent’da tanlangan Business Portfolio va aynan Instagram account asset tanlanganini tekshirtiring. Meta Developer Unified Login config’dagi asset/required permissionlarni tekshiring. Parol/kod/token so‘ramang.
4. Foydalanuvchi o‘zi official Meta consent’ni qayta tugatgach server logidagi `asset_discovery_empty` yoki muvaffaqiyatli account discovery’ni kuzating. Bo‘sh ro‘yxat yana qaytsa Meta Business/config tashqi holati qolayotgan blok; uydirma id/fallback qo‘shmang.
5. Account ulanganidan keyingina account session/media picker/automation flow, webhook, real comment, DM va public reply acceptance’ga o‘ting. Har bosqichni real API dalili bilan belgilang.

### Qayta yozmaslik kerak

- Unified Login’ning `assigned_instagram_accounts` account discovery yo‘lini fake/assumed account ID yoki Instagram password login bilan chetlab o‘tmang.
- Bo‘sh `data`ni “connected” deb saqlamang; Meta login tokenini callback/browserga chiqarmang.
- “Webhooks/messages/comments ruxsati bor” degan test config inferensiyasini real subscriber testiga teng ko‘rmang.

