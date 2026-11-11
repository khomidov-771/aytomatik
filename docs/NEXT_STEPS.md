# Keyingi qadamlar

Ustuvorliklar 2026-11-12 holatiga ko‘ra. Public onboarding 4 qadamli wizardga yangilandi va commit e90505a’da production web’ga deploy qilindi; login/register faqat email/parol oqimini ko‘rsatadi, Google OAuth backend kodi saqlangan. Birinchi bajariladigan ish — valid Meta credential va eligible account bilan live Meta acceptance; oldingi credential Graph tekshiruvida code 190 bilan rad etilgan.

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

Yangi /setup oqimi 2026-11-12 da production webga deploy qilindi. Email/password session bilan login/register, Meta callbackdan qaytish, akkauntni davom ettirish va wizardning authenticated API oqimini live tekshiring.

- Hozirgi frontend test/build o‘tdi; bu real account, post yoki Meta delivery dalili emas.
- Unified Login account discovery `account_type` qaytarmasa, subtype `UNKNOWN` deb ko‘rsatiladi; Business/Creator qiymatini taxmin qilmang.
- Follow status Unified Login’da `UNKNOWN`; explicit fallback’ni tekshiring.
- Automation POST response ID, active state, selected media IDs va server-side execution history bilan verifikatsiya qiling.

## P0 — Live Meta acceptance test

Oldin production `.env.production`dagi `META_APP_SECRET` va `META_WEBHOOK_APP_SECRET`ni Meta Dashboarddagi haqiqiy App Secret bilan serverning o‘zida yangilang. Secretni chat, Git yoki logga yubormang. Yangilagandan keyin API container restart qilinadi va Meta Graph credential check code `190` bermasligi shart.

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
