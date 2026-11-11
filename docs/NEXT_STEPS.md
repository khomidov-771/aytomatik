# Keyingi qadamlar

2026-11-12 Meta OAuth auditida server muhiti, Unified Login Configuration ID va redirect URI mosligi tekshirildi; joriy App ID/Secret juftligini Meta credential probe qabul qildi. `MetaOAuthReady` Google callback yo‘liga bog‘lanib, Instagram callback’ni xato rad etgani aniqlandi va tuzatildi. Backend testlari, go vet va production build muvaffaqiyatli yakunlandi. API deploydan so‘ng public status `api_ready=true`, `enabled=true`, `login_mode=unified` bo‘ldi. Qolgan qadam — foydalanuvchi Meta oynasida rozilik berib Instagram akkauntini ulashini tasdiqlash.

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

## P0 — Yangi onboarding’ni Meta eligible account bilan live tekshirish

Avval OAuth-only patch’ning code-level quality gate’larini bajaring. Foydalanuvchi ushbu pass’da test va build qilmaslikni so‘ragani sabab natija hozircha tasdiqlanmagan. Yangi handler/migration production yoki GitHub’ga yuborilishidan oldin review qiling.

Fayllar: `api/internal/config/config.go`, `api/internal/httpapi/instagram.go`, `api/internal/httpapi/server.go`, `api/internal/store/store.go`, `api/internal/migrations/007_instagram_login.sql`, `web/components/setup-wizard.tsx`, `web/app/page.tsx`, public auth pages.

Tekshiruv: `go test ./...`, `go vet ./...`, `go build ./cmd/server ./cmd/migrate`, frontend lint/test/build, PostgreSQL migration/identity/session test. Auth callback state replay, cross-browser cookie mismatch, terms missing, unique account claim, existing account mapping va cross-tenant negative testlar bilan qoplansin. Hozir bularning hech biri yangi patch’da bajarilmagan.

Shundan keyin `/setup` oqimini real OAuth eligible account bilan live tekshiring: callback’dan so‘ng session cookie saqlanishi, account ID bilan video picker ochilishi va `POST /automations` ishlashini kuzating.

- Hozirgi frontend test/build o‘tdi; bu real account, post yoki Meta delivery dalili emas.
- Unified Login account discovery `account_type` qaytarmasa, subtype `UNKNOWN` deb ko‘rsatiladi; Business/Creator qiymatini taxmin qilmang.
- Follow status Unified Login’da `UNKNOWN`; explicit fallback’ni tekshiring.
- Automation POST response ID, active state, selected media IDs va server-side execution history bilan verifikatsiya qiling.

## P0 — Live Meta acceptance test

Joriy production App ID/Secret juftligi Meta credential probe’dan o‘tdi; secretni almashtirish hozircha talab qilinmaydi. Public status hozir `enabled=true`. Foydalanuvchi `/setup` orqali Meta consent berib Professional Instagram account asset’ini ulashi kerak. Agar `assigned_instagram_accounts` bo‘sh qaytsa, Meta configuration asset selection, portfolio ownership va berilgan permissions’ni tekshiring; token/loglarni chiqarmang.

Kerak:

- Meta App ID/App Secret;
- public HTTPS web/API URL;
- webhook verify token/App Secret;
- App role yoki tasdiqlangan test user;
- Instagram Professional Business/Creator account;
- bir test post va ikki test commenter (follower/not follower imkon bo‘lsa).

O‘zgartiriladigan fayllar faqat real response incompatibility aniqlansa:

- `api/internal/provider/provider.go`
- `api/internal/provider/provider_test.go`
- `api/internal/httpapi/instagram.go`
- `docs/PROJECT_STATUS.md`
- `docs/TEST_REPORT.md`

Tekshiruv:

1. OAuth boshidan oxirigacha, state reuse rejection.
2. Token exchange, scopes, expiry va encrypted database qiymati.
3. Ulangan akkaunt uchun media picker real post/Reels’larni thumbnail/caption bilan olishi va tanlangan media ID rule’da saqlanishi.
4. `subscribed_apps` yoki Instagram Login webhook subscription holati.
5. Signed real comment webhook.
6. FOLLOWER, NOT_FOLLOWER va permission/context yetishmagan UNKNOWN.
7. Private reply provider ID va Instagram delivery ko‘rinishi.
8. Private successdan keyingi public reply.
9. Private failureda success public reply yo‘qligi.
10. Bir comment qayta jo‘natilganda dublikat yo‘qligi.

Acceptance: har bir holat database execution/action row va Meta response ID bilan dalillanadi. Shundan oldin live integratsiya “tayyor” deb belgilanmaydi.

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

1. **P0 — Diagnostika patch’ini production’ga yetkazish.** Commit `4dbe6d4` GitHub `main` branch’ga push qilindi; serverga auto-deploy yo‘q. SSH key orqali serverga kirish muvaffaqiyatsiz bo‘ldi. Mavjud operator deploy kanali yoki serverga ruxsatli SSH key bilan deploy qiling; production checkout, `.env.production`, DB volume yoki Nginx’ni reset/overwrite qilmang.
2. **P0 — Foydalanuvchining rasmiy Meta consent oqimi.** Patch production’da ishlagach, foydalanuvchi o‘z brauzerida rasmiy Meta oynasini ochib Professional Instagram asset’ni tanlasin va ulashga rozilik bersin. Instagram parolini agentga bermang.
3. **P0 — Aniqlangan bosqich sababini tuzatish.** Faqat `token_exchange_http_<status>_code_<code>`, `asset_discovery_...` yoki `webhook_subscription_...` kabi secretsiz log daliliga qarab Meta config/permission yoki kodni o‘zgartiring.
4. **P0 — Live acceptance.** OAuth → account/session → media → webhook → signed real comment → keyword → private reply → private success’dan keyin public reply oqimini Meta response ID va execution/action history bilan tekshiring. Unified Login follow check `UNKNOWN`; tasdiqlangan capability deb ko‘rsatmang.
5. **P1 — Hujjatni yangilash.** Har yangi live dalilni `PROJECT_STATUS.md`ga yozing. Hozir Go tests/vet/build, frontend lint/unit/build va embedded PostgreSQL integration PASS; bu Meta acceptance emas.

