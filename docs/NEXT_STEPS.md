# Keyingi qadamlar

## 2026-11-14 — Post-deploy follow-up

1. REPLEO web is deployed from GitHub `main` commit `78695c2`. Production `/` and `/repleo-night-hero.jpg` return HTTP 200; the web/API/PostgreSQL/Redis containers are healthy. The old web image is preserved as `ids-automate-web:rollback-repleo-20261114`.
2. Do not pull into `/opt/ids-automate`: that checkout is 32 commits behind and has operator edits/untracked production files. Continue from a clean release worktree or build archive; keep the API, database, Nginx, `.env.production`, and existing production data unchanged for web-only releases.
3. The production DB has 25 processed comment events, 11 successful Meta private replies, and 12 successful public replies with provider result IDs. The 11 private successes precede their public replies. One follow-check provider error became `UNKNOWN` and correctly used the skip-DM/neutral-public fallback.
4. Remaining live acceptance: establish why follow-check returns a provider error and test a real eligible follower/non-follower only through official Meta APIs; complete a fresh user-authorized OAuth callback; verify Inbox UI/manual-reply behavior against an authorized conversation (DB already has 8 inbound/12 outbound Meta message rows with provider IDs); and trigger one fresh comment from a second authorized test account after deploy. Never use or request an Instagram password.
5. Full `npm audit` still reports 7 moderate advisories in build/dev-only `typescript-eslint` → `minimatch`; production dependency audit is clean (`npm audit --omit=dev`, 0 vulnerabilities), and the lint toolchain is absent from the runtime image. Revisit when upstream publishes a patched compatible dependency; avoid forcing the major minimatch version without tests.
6. Remove the temporary SSH key after deployment checks and ask the owner to rotate the supplied root password. Do not print or store credentials in Git, logs, docs, or chat.

2026-11-12 joriy holat: production Meta app webhook obunasida `comments,messages,messaging_postbacks` rasmiy Graph API orqali yozildi va qayta `GET` bilan tasdiqlandi. PostgreSQL’da real account hozir `disconnected`; faol qoida, webhook event va execution `0`. Oldingi real OAuth/media muvaffaqiyati tarixiy dalil, hozirgi faol ulanish emas.

## P0 — xabar yuborish oqimini qayta tiklash

1. Workspace egasi `/app/accounts`dagi **Qayta ulash** orqali official Meta OAuth’ni qayta yakunlaydi. Instagram paroli, OTP, authorization code yoki tokenni agentga bermaydi. `instagram_accounts.status=connected` va yangi token bilan media ro‘yxati ishlashini faqat metadata orqali tekshiring.
2. `/setup` yoki automation builder’da kerakli post, aniq keyword, private DM va public reply matnlarini kiritib, qoidani **faol** saqlaydi. Qoidaning account, media scope, keyword va `is_active=true` holatini API/database’dan tasdiqlang. O‘chirilgan ikki qoidaning matnini taxmin qilib tiklamang.
3. Account darajasidagi `GET /{ig-id}/subscribed_apps` real authorized token bilan `comments` fieldini ko‘rsatishini secretsiz tekshiring. App darajasidagi obuna allaqachon tekshirilgan, ammo bu account va haqiqiy delivery o‘rniga o‘tmaydi.
4. Ikkinchi ruxsatli test akkaunt yangi keyword comment yozadi. Signed webhook, event, execution, private action va Meta message ID’ni ketma-ket kuzating. Private successdan keyingi public reply’ni alohida tasdiqlang; Meta reject/timeout yoki duplicate holatini sent deb ko‘rsatmang.
5. Agar event kelmasa, Meta App Review/access mode, account subscription va callback delivery diagnostikasini tekshiring. Agar event kelib DM rad etilsa, faqat sanitized Meta HTTP/numeric error code asosida provider/permission muammosini tuzating.

2026-11-12 yangilanishi: foydalanuvchi Meta Unified Login’da Business/Creator akkauntni tanlab ruxsat berdi; `@khomidov_771` production’da ulandi. Media API’dagi `+0000` timestamp parse xatosi `009b920`da tuzatildi, GitHub `main`ga push qilindi va faqat API image deploy qilindi. Production wizard’da real akkauntdan 2 ta post chiqdi. OAuth/account discovery va media listing o‘tdi; signed webhook, comment execution, follow natijasi, DM va public reply hali live tasdiqlanmagan.

Joriy frontendda UZ/RU/EN va light/dark tema tayyor. Yangi ekran qo‘shilganda matnni `usePreferences().tr(uz, ru, en)` orqali uchala tilda berish va ikkala temada ko‘rish talab qilinadi.

## Ixtiyoriy — Google OAuth backend (public UI’da yo‘q)

Server-side Google OAuth/OIDC oqimi bor, ammo joriy public login/register UI unga ulanmagan. Product egasi Google’ni public authentication’ga qaytarishga alohida qaror qilmaguncha bu credential setup joriy onboarding’ni unblock qilmaydi. Agar kelajakda so‘ralsa, production status `enabled=false`; client ID/secret Google Cloud Console’dan server `.env.production`ga xavfsiz kiritilib, real consent acceptance alohida bajariladi. Secretni Git, log yoki chatga yozmang.

Google Cloud Console’dagi Authorized redirect URI aynan quyidagicha bo‘lsin:

```text
https://instagram.schat.uz/api/v1/auth/google/callback
```

Oxirgi tekshirilgan server natijasi: `GET /api/v1/auth/google/status` HTTP 200, `{"enabled":false}`; credentialsiz start HTTP 503.

Kod/konfiguratsiya fayllari:

- `api/internal/httpapi/google_oauth.go`
- `api/internal/store/store.go`
- `api/internal/migrations/006_google_oauth.sql`
- `api/internal/config/config.go`
- `web/components/google-auth-button.tsx` (orphan component; public login/register sahifalarida ishlatilmaydi)
- `.env.example`, `docker-compose.prod.yml`, `deploy/nginx/default.conf.template`

Local Google backend testi uchun Google Cloud’da `http://localhost:8080/api/v1/auth/google/callback` callback URI va `GOOGLE_REDIRECT_URL` kerak. Haqiqiy Google credential bo‘lmasa OAuth’ni live ishlaydi deb ko‘rsatmang.

## Bajarildi — OAuth ulanishi va real media picker

- Foydalanuvchi rasmiy Meta consent’ni o‘zi tasdiqladi; production UI `@khomidov_771` akkauntini `Meta · Unified Login` sifatida ulangan deb ko‘rsatdi.
- Media parse xatosi `009b920`da tuzatildi. `go test ./...`, `go vet ./...`, `go build ./cmd/server ./cmd/migrate` PASS.
- API image alohida detached worktree’dan build qilindi va production’da faqat API servisi bilan almashtirildi. Rollback image saqlandi; server root checkout’dagi operator edits, `.env.production`, PostgreSQL, web va Nginx o‘zgartirilmadi.
- Production `/healthz` va Instagram OAuth status HTTP 200; API/web/PostgreSQL running. Browser wizard’da Meta API’dan 2 ta real post ko‘rindi.
- OAuth/account discovery va token-backed media list tasdiqlandi; webhook subscription/test delivery, follow, DM yoki public reply live tasdiqlangani yo‘q.

## P0 — Comment-to-DM live acceptance

OAuth/account discovery va real media list 2026-11-12 production’da PASS. Quyidagi oqimlar hali live sinovdan o‘tmagan; `enabled=true` faqat sozlama holati, DM/comment acceptance emas. Unified Login’da follow check hozircha `UNKNOWN` bo‘lib qoladi. Token/loglarni chiqarmang.

Qolgan kerakli shartlar:

- Ulangan akkaunt uchun signed real comment webhook Meta’dan saytga yetib kelishi.
- Ajratilgan test post va testga ruxsatli ikkinchi Instagram akkaunt.
- Foydalanuvchi tasdiqlagan aniq test keyword hamda private/public javob matnlari.
- Real comment va DM yuborishdan oldin qabul qiluvchi, post va matn bo‘yicha foydalanuvchining action-time roziligi.

O‘zgartiriladigan fayllar faqat real response incompatibility aniqlansa:

- `api/internal/provider/provider.go`
- `api/internal/provider/provider_test.go`
- `api/internal/httpapi/instagram.go`
- `docs/PROJECT_STATUS.md`
- `docs/TEST_REPORT.md`

Tekshiruv:

1. Meta webhook subscription va real signed test comment delivery.
2. Tasdiqlangan post/unikal keyword comment’ida webhook, event, rule va action history.
3. Unified Login follow check `UNKNOWN` fallback; `FOLLOWER` yoki `NOT_FOLLOWER` natijalarini asossiz ko‘rsatmaslik.
4. Foydalanuvchi tasdiqlagach official private-reply delivery, provider message ID va execution action status.
5. Public success reply faqat Meta private reply muvaffaqiyatini tasdiqlagach yuborilishini tekshirish.
6. Meta test akkauntida private-reply rejection/permission scenario; xatoda public “DM yuborildi” chiqmasin.
7. Xuddi shu comment qayta yetkazilganda duplicate DM va public reply bo‘lmasin.

Acceptance: har bir holat database execution/action row va Meta response ID bilan dalillanadi. Shu testlar va foydalanuvchining action-time roziligisiz live integratsiya “tayyor” deb belgilanmaydi.

## P0 — Login path bo‘yicha follow capability qarori

Joriy `META_LOGIN_MODE=unified` bo‘lsa follow check ataylab `UNKNOWN`. Real Meta hujjati va App konfiguratsiyasida `is_user_follow_business` support tekshiriladi.

- Agar faqat Instagram Login’da support bo‘lsa, production account ulashda shu yo‘l talab qilinsin yoki builderda capability aniq ko‘rsatilsin.
- Missing field, permission error, rate limit va network ambiguity doim `UNKNOWN` qolishi shart.
- Scraping yoki private API qo‘shilmaydi.

Fayllar: `provider.go`, `accounts/page.tsx`, `automation-form.tsx`, status docs.

Test: controlled response + real eligible follower/non-follower/unknown account.

## P1 — Real provider error catalog va operator retry

Meta real xatolaridan qayta ishlash jadvalini yarating:

- permanent permission/policy rejection;
- rate limit;
- expired/revoked token;
- one-private-reply violation;
- private-reply time-window violation;
- network timeout/ambiguous result.

Private reply uchun avtomatik blind retry taqiqlangan. Operator UI faqat xavfsiz public-reply retry yoki reconnect action ko‘rsatishi kerak.

Fayllar: `provider.go`, `worker.go`, `automation-form.tsx`, yangi migration kerak bo‘lsa `006_*.sql`.

Test: table-driven provider tests, DB retry-state integration, no-duplicate assertion.

## P1 — Webhook fixture coverage

Real Meta’dan redacted fixturelar oling:

- comment create;
- inbound DM;
- deleted/unsupported event;
- duplicate delivery;
- missing username/participant;
- malformed signature/body.

Fayllar: `api/internal/provider/testdata/`, `provider_test.go`, `httpapi` tests.

Test: fixture parser, signature positive/negative, duplicate accepted=0.

## P1 — Production observability

Qo‘shing:

- structured request/event correlation ID;
- queue lag, lease recovery, action status va Meta latency metrics;
- token-expiry/reconnect alert;
- failed execution operator filter;
- secret-redaction regression tests.

Fayllar: server/worker/store, frontend history/analytics, deployment config.

## P2 — Inbox live acceptance

Real inbound DM bilan 24-soat reply window ochilishini, duplicate inbound event count oshirmasligini va manual send idempotency key’ini tekshiring.

Fayllar: `httpapi/instagram.go`, `httpapi/app.go`, `store.go`, Inbox UI.

## P2 — Data lifecycle

`pending_manual_review` deletion requestni avtomatik deb ko‘rsatmang. Owner/legal bilan retention, export, token revoke, messages/comments PII va backup expiry tasdiqlangandan keyin alohida queued workflow yarating.

## Scope’dan tashqari

- subscription/payment/billing;
- demo account yoki demo credentials;
- fake analytics;
- scraping/private Instagram APIs;
- live dalilsiz “follow verification ishlaydi” da’vosi.

## 2026-11-12 — OAuth callback diagnostikasi

1. **P0 — Foydalanuvchining rasmiy Meta consent oqimi.** Diagnostika release’i `d5c1678` production API va web servislarida ishlayapti; health, OAuth status, same-origin `terms_required` preflight va sahifa smoke tekshiruvlari PASS. `/setup`da ilova shartlari checkbox’i hozir belgilanmagan, shuning uchun tugma o‘chiq. Foydalanuvchi shartlarni ko‘rib o‘zi qabul qilsin, keyin Meta oynasida Professional Instagram asset va ruxsatlarni o‘zi tasdiqlasin. Instagram parolini agentga bermang.
2. **P0 — Callback bosqichini tekshirish.** Foydalanuvchi Meta’dan qaytgach, faqat stage/status/numeric error code kabi secretsiz log dalillarini o‘qing. Eski screenshotdagi sabab noma’lum; yangi diagnostika token exchange, asset discovery va webhook subscription bosqichlarini ajratadi.
3. **P0 — Aniqlangan sababni tuzatish.** Faqat yangi callback’dan olingan aniq `token_exchange`, `asset_discovery` yoki `webhook_subscription` xatosiga qarab Meta config/permission yoki kodni o‘zgartiring; token, auth code, parol yoki secret log/chatga chiqmasin.
4. **P0 — Live acceptance.** OAuth → account/session → media → webhook → signed real comment → keyword → private reply → private success’dan keyin public reply oqimini Meta response ID va execution/action history bilan tekshiring. Unified Login follow check `UNKNOWN`; tasdiqlangan capability deb ko‘rsatmang.
5. **P1 — Hujjatni yangilash.** Har yangi live dalilni `PROJECT_STATUS.md`ga yozing. Go tests/vet/build, frontend lint/unit/build va embedded PostgreSQL integration PASS; production smoke PASS. Bular Meta acceptance emas.

