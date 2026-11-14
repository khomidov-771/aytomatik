# Project status

## 2026-11-14 — REPLEO deployed and verified

- The visible product name is REPLEO; internal repository and service identifiers remain unchanged.
- Implemented the approved cinematic landing direction: generated night landscape asset, canvas particle path for comment → keyword → Direct, updated marketing page, forest/emerald design layer, responsive rules, reduced-motion handling, and REPLEO metadata/wordmark.
- Removed the prior `replio.css` stylesheet from the global import chain so its blue-violet theme cannot override the approved REPLEO visual direction. The file itself is preserved in the worktree.
- Fixed `web/Dockerfile` to copy `web/public` into the standalone runtime image; this was why the approved hero image was absent. Commit `78695c2` is pushed to GitHub `main`.
- Deployed only the web service from the clean `78695c2` release. The previous web image is retained as `ids-automate-web:rollback-repleo-20261114`. API, PostgreSQL, Redis, Nginx, `.env.production`, production data, and the dirty `/opt/ids-automate` checkout were left untouched.
- Production page returned HTTP 200 with title `REPLEO`; `/repleo-night-hero.jpg` returned HTTP 200 (`image/jpeg`). Web, API, PostgreSQL, and Redis containers were healthy after deploy. Production UI E2E passed (1 test); it used controlled auth/status responses, while live API status and OAuth-start were checked separately.
- Local checks passed: frontend lint, 2 frontend unit tests, 22-route production build, E2E (1 flow), Go unit tests, `go vet`, Go build, and PostgreSQL store/API integration tests.
- PII-free production DB aggregates show one connected Meta account, 25 processed `comment_created` events, 12 completed executions, 11 Meta private replies succeeded with provider result IDs, and 12 Meta public replies succeeded with result IDs. All 11 successful private replies completed before their public reply; one `UNKNOWN` follow-check failure took the configured skip-DM/neutral-public fallback. Inbox history also has 8 inbound `received` and 12 outbound `sent` Meta messages, each with a provider result ID. A follower/non-follower follow check is not verified.
- Production Instagram status is enabled and API-ready; `register` and `login` OAuth starts returned official `www.instagram.com` URLs. A full user consent/callback was not performed in this check. Full `npm audit` reports 7 moderate advisories in build/dev-only `typescript-eslint` → `minimatch`; `npm audit --omit=dev` found 0, and those tools are absent from the runtime image.
- The product is **not 100% verified**: follow verification remains unproven, and fresh OAuth callback, inbound DM/manual Inbox reply, and a new post-deploy comment are not live-tested. Historical Meta action rows confirm the private/public delivery path worked for the recorded events.

Tekshiruv: 2026-11-12. Branch main; audit hujjatlari commit 4218851, Google OAuth kod commit 8c15cde, frontend onboarding redesign commit e90505a. Holat repository kodi, bajarilgan testlar va production endpoint/container tekshiruvlariga asoslangan.

## Eng so‘nggi production holati — 2026-11-12

- `@khomidov_771` avval real OAuth bilan ulangan va ikki media post olingan, ammo joriy PostgreSQL holati `disconnected`. Audit jurnalida 07:38 UTC atrofida ikki `automation.deleted` va bir `instagram.disconnected` amal qayd etilgan. Hozir `automation_rules`, `webhook_events`, `automation_executions` va `automation_execution_actions` jadvallarida har birida `0` qator bor. Shu holatda private reply adapteri real comment uchun chaqirilmagan.
- Meta Graph API `GET /{app-id}/subscriptions?fields=object,callback_url,fields,active` dastlab `HTTP 200`, Instagram obunasi `active=true` va production callback mosligini qaytardi, lekin `fields` maydoni yo‘q edi. `POST /{app-id}/subscriptions` bilan `comments,messages,messaging_postbacks` yozildi: `HTTP 200`, `success=true`. Qayta `GET` aynan shu uch field, `active=true` va mos callback’ni qaytardi. Serverda webhook HMAC secret Meta App Secret bilan mosligi faqat boolean sifatida tekshirildi; secret qiymatlari olinmadi.
- Bu app darajasidagi webhook konfiguratsiya tuzatishi. Account darajasidagi yangi `subscribed_apps`, signed real comment webhook, keyword match, private DM va public reply hali live tekshirilmagan. Akkaunt official Meta OAuth orqali qayta ulanib, faol qoida saqlanib, boshqa test hisobdan yangi mos comment kelmaguncha productning asosiy oqimi tayyor deyilmaydi.
- Joriy tekshiruv faqat production metadata va Meta Graph API bilan bajarildi; kod, database, image va `.env.production` o‘zgartirilmadi, DM yuborilmadi. Oldingi lokal build/test natijalari yangi live acceptance dalili emas.

## Eng so‘nggi real Meta dalili — 2026-11-12

- Foydalanuvchi rasmiy Unified Login oynasida Professional Instagram akkauntini tanlab ruxsat berdi. Production UI `@khomidov_771` akkauntini `Meta · Unified Login` va `Ulangan` holatida ko‘rsatdi.
- OAuth callback’dan keyin account/session yaratildi; ulangan akkaunt uchun production media so‘rovi dastlab HTTP 200 javobini dekodlashda yiqildi. Xavfsiz server logida `meta_api_http_200_code_0` ko‘rindi.
- Root cause: Meta media `timestamp` qiymati `+0000` timezone offset bilan kelishi mumkin, ammo Go `time.Time` default JSON decoderi bu shaklni qabul qilmaydi. `Media.UnmarshalJSON` Meta kompakt offseti, fractional seconds va RFC3339’ni qabul qiladi; null/missing timestamp media listni buzmaydi.
- Tuzatish `009b920` commitida GitHub `main`ga push qilindi. Backend `go test ./...`, `go vet ./...`, `go build ./cmd/server ./cmd/migrate` — barchasi PASS.
- Production’da faqat API image qayta build/recreate qilindi. Oldingi API image rollback uchun saqlandi; PostgreSQL, web, Nginx, `.env.production`, root checkout’dagi operator edits/untracked files va DB schema o‘zgartirilmadi.
- Deploydan keyin production `/healthz` HTTP 200 (`status=ok`), Instagram status HTTP 200 (`api_ready=true`, `enabled=true`, `login_mode=unified`) va API/web/PostgreSQL containerlar `running` holatida. User browser’da real ulangan akkauntdan 2 ta Meta media post ko‘rindi; oxirgi 10 daqiqada media sync xatosi loglanmadi.
- **Tasdiqlangan:** real Meta OAuth/account discovery va media list. **Tasdiqlanmagan:** signed webhook event, real comment rule execution, follow check, private reply delivery va DM muvaffaqiyatidan keyingi public reply. Shu sabab mahsulotning asosiy comment-to-DM oqimi hali to‘liq tayyor emas.

## Umumiy natija

Oldingi 17-gate Meta auditining 70.6% ko‘rsatkichi Google OAuth va yangilangan production kuzatuvini o‘z ichiga olmaydi; shu sabab u joriy tayyorlik foizi sifatida ishlatilmasin. Google oqimi controlled testlarda o‘tdi va yangi kod production’ga deploy qilindi. Production status endpoint `enabled=false` qaytaryapti, chunki Google OAuth client qiymatlari serverda yo‘q. Shu bois hozirgi holat **100% emas**, joriy foiz qayta hisoblanmagan.

Bu product completion foizi emas. Meta yoki Google’dagi real foydalanuvchi oqimi controlled test dalili bilan almashtirilmaydi.

## Gate’lar

| # | Gate | Holat | Dalil |
|---:|---|---|---|
| 1 | Backend compile | PASS | `go build ./cmd/server ./cmd/migrate` |
| 2 | Backend unit tests | PASS | `go test ./...` |
| 3 | Backend static analysis | PASS | `go vet ./...` |
| 4 | Frontend lint | PASS | `npm run lint:web` |
| 5 | Frontend unit tests | PASS | 1 file, 2 tests |
| 6 | Frontend production build | PASS | Next.js production build, 22 routes; restricted Windows worker first returned `EPERM`, rerun with normal process permissions passed |
| 7 | PostgreSQL migrations/integration | PASS | `go test -tags=integration -v ./internal/store`; embedded PostgreSQL, Google identity and tenant/store tests |
| 8 | Auth/session/CSRF | PASS controlled | Unit/integration coverage |
| 9 | Multi-tenant isolation | PASS controlled | Cross-tenant account/execution/action negative checks |
| 10 | OAuth/token/webhook request logic | PASS controlled | Provider/security tests; no live Meta |
| 11 | Comment-to-DM decision matrix | PASS controlled | Worker tests cover disabled/follower/not-follower/UNKNOWN policies |
| 12 | Action idempotency/history | PASS controlled | PostgreSQL action ledger retry/dedup/history test |
| 13 | Live Meta OAuth/account | PASS historically; start PASS now | Production DB has one Instagram OAuth identity and one connected Meta account; current status/start endpoints return ready/official URL. Fresh callback not run in this check |
| 14 | Production comment event processing | PASS for recorded events | 25 `comment_created` rows processed for the Meta account; no new event after this web deploy. Raw signature was not logged for reinspection |
| 15 | Live follow verification | NOT VERIFIED | One provider error mapped to `UNKNOWN`; configured fallback correctly skipped DM and completed a public reply. No live FOLLOWER/NOT_FOLLOWER proof |
| 16 | Live private reply | PASS for recorded events | 11 Meta private-reply actions succeeded with provider result IDs |
| 17 | Live public reply and ordering | PASS for recorded events | 12 Meta public replies succeeded with result IDs; 11 followed confirmed private success, one followed the UNKNOWN skip-DM policy |

Production Inbox history also contains 8 inbound and 12 outbound Meta messages with provider IDs. This establishes historical message persistence/delivery records; a fresh UI/manual-reply acceptance was not performed in this checkpoint.

## Modul holati

| Modul | Haqiqiy holat |
|---|---|
| Legacy registration/login/email verification/reset backend | Kod saqlangan; public email/parol sahifalari Instagram onboarding’ga redirect qiladi. Ushbu auth/UI o‘zgarishi hozir test qilinmagan |
| Instagram OAuth public authentication | Production’da Unified Login orqali bitta real Professional account ulandi; callback/session/account discovery ishladi. Keng App Review/canary account holatlari alohida tasdiqlanmagan |
| Session/CSRF/RBAC/workspace switch | Implemented va controlled testdan o‘tgan |
| Multi-tenant store | Implemented; cross-tenant negative integration test bor |
| Instagram account UI | Real OAuth-only; demo account yaratmaydi |
| Instagram Login adapter | Kod va controlled HTTP test bor; live tekshirilmagan |
| Unified Login adapter | Production OAuth, assigned asset discovery va `subscribed_apps` success ishladi. Signed real webhook event hali olinmagan |
| Token encryption | AES-256-GCM implementation/controlled test bor; OAuth’dan keyin saqlangan real token bilan media API muvaffaqiyatli ishladi. Token qiymati chiqarilmagan yoki loglanmagan |
| Webhook verify/parser | HMAC va Meta-shaped payload controlled test bor; live payload tekshirilmagan |
| Automation builder/media picker | Account/keyword/templates/follow/fallback/active fields UI/API mavjud. 2026-11-12 production’da `GET /media` real connected account’dan 2 ta post qaytardi; user browser’da cards ko‘rindi |
| Follow tri-state | Implemented. Unified → UNKNOWN. Instagram Login field/error semantics controlled testda |
| Private reply | Official endpoint adapter va state machine implemented; live tekshirilmagan |
| Public comment reply | Private successdan keyingi branch implemented; live tekshirilmagan |
| Idempotency/retry | Event, action va manual message markerlar implemented; DB testdan o‘tgan |
| Execution history | API + UI implemented; actionlar alohida ko‘rinadi |
| Inbox | Inbound store/manual reply window implemented; live DM tekshirilmagan |
| Analytics | Database’dagi real event/actionlardan hisoblanadi; fake seed yo‘q |
| UI/lokalizatsiya | UZ/RU/EN va light/dark saqlanadi. Landing hero to‘q binafsha uslubga yangilandi. `/setup` 4 bosqichli wizard real account/media/automation API’lariga ulangan; loading/error/empty, kichik ekran va reduced-motion holatlari bor. Accessible custom dropdown va avvalgi motion tizimi saqlangan |
| Billing/subscription | Product scope’dan olib tashlangan; route/UI/config yo‘q |
| Demo/mock product mode | Olib tashlangan; mock adapter faqat automated test uchun |

## Production Meta audit — 2026-11-10

- Web va API health: `200`; PostgreSQL container healthy.
- Active environment `production`, provider `meta`, login mode `unified`, redirect HTTPS va Unified configuration ID mavjud.
- Active App ID/App Secret bilan Meta Graph credential check `HTTP 400`, `OAuthException` code `190` qaytardi.
- App Secret va webhook App Secret 10 belgilik placeholder ko‘rinishida; valid Meta credential sifatida qabul qilinmaydi.
- Database: 1 ta eski `mock` account `disconnected`, encrypted token yo‘q; real Meta account `0`.
- Active automation `0`, webhook event `0`, execution/action `0`.
- API endi non-empty placeholderni `meta_configured=true` deb ko‘rsatmaydi va account connectni credential tuzatilmaguncha bloklaydi.

Bu holatda real comment-to-DM oqimi ishlamaydi. Valid Meta App Secret serverga xavfsiz kiritilib, Professional account OAuth orqali ulangach va active automation yaratilgach live acceptance bajarilishi kerak.

## 2026-11-11 joriy audit — Google OAuth va production deploy

### Kodda bajarilgan

- Server-side Google OAuth 2.0 / OIDC authorization-code oqimi; `openid email profile` scope.
- State 10 daqiqa amal qiladi, DB’da hash saqlanadi va bir marta consume qilinadi. HttpOnly/SameSite=Lax browser cookie, allowlisted `Origin`, PKCE S256 va OIDC nonce tekshiruvi mavjud.
- Google ID token uchun Google issuer, client audience, imzo, expiry va `email_verified` tekshiriladi. Token saqlanmaydi; `sub` identity link sifatida saqlanadi.
- Yangi signup alohida owner workspace yaratadi; login yangi hisob yaratmaydi. Google verified email mavjud local user bilan link qilinishi mumkin.
- Migration `006_google_oauth.sql` additive. Client credentials yo‘q bo‘lsa API `enabled=false` va start 503 qaytaradi; UI bu holatni yashirmaydi.
- 2026-11-11 holatida Google OAuth backend server-side qolgan, public UI tugmasi bo‘lmagan va onboarding email/parol auth’dan keyin Meta account connect bo‘lgan. 2026-11-12 OAuth-only onboarding bo‘limi bu UX holatini o‘zgartiradi.

### Joriy kod tekshiruvi

```text
go test ./...                                                   PASS
go vet ./...                                                    PASS
go build ./cmd/server ./cmd/migrate                              PASS
go test -tags=integration ./internal/store                       PASS
  - TestGoogleLoginStateAndIdentityLinking
  - TestTenantTokensInboxAndQueue
go test -tags=integration ./internal/httpapi -run TestGoogle... PASS
  - Controlled OIDC issuer, RSA signature, state replay va nonce mismatch
npm run lint:web                                                 PASS
npm run test:web                                                 PASS (2/2)
npm run build:web                                                PASS (21 routes)
```

Google OIDC controlled test haqiqiy Google akkaunti yoki live Google service deyilmaydi. U disposable PostgreSQL va lokal imzolangan test tokenidan foydalanadi. Frontend build Windows sandboxida `.next` katalogi uchun `EPERM` bergan; shu sabab ayni build workspace’da elevated ruxsat bilan yakunlandi.

### Production server kuzatuvi — 2026-11-11

- `https://instagram.schat.uz/` va `/healthz`: HTTP 200.
- API, web va PostgreSQL konteynerlari ishlayapti; PostgreSQL migration ro‘yxatida `006_google_oauth.sql` mavjud.
- `GET /api/v1/auth/google/status`: HTTP 200, `{"enabled":false}`. Credentialsiz `POST /api/v1/auth/google/start`: HTTP 503 — server sozlanmaganini ochiq bildiradi.
- Production web/API image’lari `8c15cde` (`Add secure Google OIDC sign-in`) commitidan deploy qilindi. Audit hujjatlari `4218851` commitida GitHub `main`ga push qilindi; bu hujjat o‘zgarishi runtime image’larni o‘zgartirmaydi.
- Deployning birinchi urinishida Compose `.env.production` faylini `--env-file` bilan yuklamagani uchun API database environment qiymatlarisiz qayta yaratilib restart loopga tushdi. Production DB konteyneriga tegilmagan. To‘g‘ri `.env.production`ni Compose’ga bergach API tiklandi; health va Google status endpointlari qayta tekshirildi.
- Server `.env.production` ichida Google Client ID va Client Secret qiymatlari yo‘q. Haqiqiy Google consent/signup/login hali bajarilmagan.
- Server Git working tree’dagi `.env.production`, compose va boshqa untracked operator fayllari saqlandi; ular tozalanmadi yoki tracked nusxa bilan almashtirilmadi.
- Meta Graph credential oldingi live tekshiruvda OAuth code `190` bilan rad etilgan; bu deployda secret bilan qayta tekshirilmagan. `meta_configured` flag live Meta acceptance dalili emas.

Production’da Google OAuth kodi mavjud, lekin Google client credentialsiz real Google login ishlamaydi. Meta live Comment-to-DM ham avvalgi bloklangan holatda. Controlled testlar real tashqi xizmat muvaffaqiyati hisoblanmaydi.

## Comment-to-DM outcome matrix

| Follow setting/status | Private reply | Public reply |
|---|---|---|
| Disabled | Yuboriladi | Faqat private successdan keyin success template |
| `FOLLOWER` | Yuboriladi | Faqat private successdan keyin success template |
| `NOT_FOLLOWER` | Yuborilmaydi | Not-follower template |
| `UNKNOWN` + `send_private_reply` | Yuboriladi | Faqat private successdan keyin success template |
| `UNKNOWN` + `skip_dm_neutral_reply` | Yuborilmaydi | Neutral UNKNOWN template |
| Private rejected/ambiguous | Success deb belgilanmaydi | “DM yuborildi” public reply yuborilmaydi |
| Private success + public retryable failure | Private qayta yuborilmaydi | Faqat public action maksimal 3 urinish |

## Test natijalari

2026-11-10 bajarilgan:

```text
go test ./...                                                   PASS
go test -tags=integration ./internal/store -run TestTenant...  PASS
npm run lint:web                                                PASS
npm run test:web                                                PASS (2/2)
npm run build:web                                               PASS (21 routes)
```

Frontendning UZ/RU/EN, light/dark va 2026-11-10 professional UI yangilanishlari aynan shu lint, 2/2 unit test va 21-route production build bilan qayta tekshirildi. Dashboard onboarding faqat real account/active automation holatidan foydalanadi; fake progress yoki fake analytics yaratmaydi. Real series bo‘lmasa grafik o‘rnida aniq bo‘sh holat ko‘rsatiladi.

Visual post picker o‘zgarishidan keyin `go test ./...`, `go vet ./...`, frontend lint, 2/2 unit test va 21-route production build qayta PASS bo‘ldi. `/{ig-user-id}/media` request host/path/auth/fields ikkala login mode uchun controlled provider test bilan tekshirildi; bu live Meta media access dalili emas.

Docker CLI bu Windows muhitida o‘rnatilmagan. PostgreSQL integration test cached embedded PostgreSQL 18.6.1 bilan real database processga qarshi o‘tdi. Bu in-memory/mock DB emas.

Frontend build dastlab cheklangan Windows process huquqida `.next/standalone` yaratishda `EPERM` berdi; generated `.next` tozalanib odatiy Windows huquqida qayta bajarilganda PASS bo‘ldi.

## Aniqlangan cheklovlar

- Public HTTPS callback mavjud, ammo joriy Meta App credential Meta tomonidan code `190` bilan rad etilgan.
- `is_user_follow_business` Unified/Facebook Login yo‘lida tasdiqlanmagan; kod bu holatda `UNKNOWN` qiladi.
- Instagram Login yo‘lida ham follow field real eligible user/account bilan sinovdan o‘tmagan.
- Meta rate-limit, revoked token, App Review va one-private-reply/time-window xatolari real response bilan tekshirilmagan.
- Current queue process bir processli worker; horizontal deployment uchun distributed wake-up/lease observability kengaytirilishi kerak.
- Data deletion hozir auditdagi `pending_manual_review`; avtomatik deletion workflow emas.
- Media picker real connected account/access token bo‘lmagani sabab production Meta response bilan hali tekshirilmagan.

## Muhim aniqlik

Controlled provider testlari request URL/body, response parsing va state transitionni isbotlaydi. Ular Meta App approval, permission availability, real delivery yoki follow checkni isbotlamaydi.

## 2026-11-11 — Onboarding redesign va joriy quality gate

### Amalga oshirilgan

- Public landing hero to‘q binafsha uslub va CSS telefon oqimi ko‘rinishiga yangilandi; mavjud uch tilli navigatsiya saqlandi.
- Public CTA login/register’dan keyin `/setup`ga olib boradi; email tasdiqlash davomida ham faqat ruxsat etilgan local setup manzili saqlanadi.
- Yangi `/setup` 4 qadamli wizard real Instagram account, Meta media, keyword/match mode, DM/public reply, ixtiyoriy follow verification, UNKNOWN policy va active flag’ni sozlaydi.
- Wizard mavjud API’lardan foydalanadi; yangi endpoint/schema qo‘shilmadi. Saqlash muvaffaqiyati faqat server automation ID qaytargach ko‘rsatiladi.
- Meta OAuth callback va redirect URI o‘zgarmadi. Callback’dan keyin accounts sahifasi ulangan account ID bilan wizard’ning post tanlash qadamini davom ettiradi.
- Google sign-in tugmasi public login/register UI’dan olib tashlandi; server-side Google OIDC code va migration saqlandi.
- Unified Login `/me/assigned_instagram_accounts` response’da `account_type` bermagani uchun yangi account subtype `UNKNOWN` saqlanadi; UI turini taxmin qilmaydi.

### 2026-11-11 test natijalari

```text
npm run lint:web                                      PASS, warnings/errors yo‘q
npm run test:web                                      PASS, 1 file / 2 tests
npm run build:web                                     PASS, 22 routes (normal process permission bilan)
Standalone smoke                                    PASS, 6 routes HTTP 200; /setup loading HTML; login/register’da Google marker yoki demo marker yo‘q
go test ./...                                         PASS
go vet ./...                                          PASS
go build ./cmd/server ./cmd/migrate                   PASS
go test -tags=integration -v ./internal/store         PASS, embedded PostgreSQL
```

Docker CLI bu Windows muhitida mavjud emas; PostgreSQL integratsiya Docker containerda emas, disposable embedded PostgreSQL’da bajarildi. Cheklangan processda Postgres executable `Access is denied` qaytargan; shu izolyatsiyalangan test normal process permission bilan o‘tdi. To‘liq Playwright E2E lokal API/servislar mavjud bo‘lmagani sabab ishga tushirilmadi.

### Tashqi integratsiya holati

- O‘sha production tekshiruvidagi Meta App Secret Graph API `OAuthException` code `190` bilan rad etilgan; 2026-11-12 dagi joriy server App ID/Secret juftligi credential probe’dan o‘tdi. Real Instagram OAuth, webhook, follow field, private reply yoki public reply hali live test qilinmadi.
- Google OAuth backend production’da `enabled=false`; Google tugmasi public UI’da yo‘q. Backend credentials/live flow bu UI patch’ida o‘zgartirilmadi.
- Unified Login subtype unknown saqlanishi Meta account discovery va live follow/API acceptance o‘rnini bosmaydi.

## 2026-11-12 — Frontend redesign production deploy

- Commit e90505a GitHub main’ga push qilindi va production web service’ga deploy qilindi.
- Server /opt/ids-automate checkout’ida API fayllarining tracked local edits va .env.production*, docker-compose.ids.yml kabi operator untracked fayllari bor edi. Main checkout’da pull/checkout/reset/clean ishlatilmadi.
- Build uchun origin/main’dan /tmp/ids-automate-web-e90505a detached worktree ishlatildi. Compose shu worktree’dan build qildi va mavjud ids-automate project’ga faqat web service deploy qilindi (--no-deps).
- Docker image build muvaffaqiyatli tugadi; Next.js production build 22 route yaratdi. ids-automate-web-1 qayta yaratilib ishga tushdi.
- Deploydan so‘ng Compose holati: api running, postgres running/healthy, web running.
- Public HTTP smoke: /, /setup, /login?next=%2Fsetup, /register?next=%2Fsetup, /healthz — barchasi HTTP 200.
- Production .env.production, database, API, nginx va operator fayllari almashtirilmadi. Server main checkout’dagi avvalgi tracked va untracked o‘zgarishlar saqlandi.
- Bu frontend deploy Meta live integratsiya ishlashini isbotlamaydi. Avval qayd etilgan App Secret rejection (OAuthException code 190), real account/webhook/action yo‘qligi sabab Meta OAuth, follow check va Comment-to-DM live acceptance hali bajarilmagan.
### Deployment cleanup

- The temporary detached worktree /tmp/ids-automate-web-e90505a was removed after deployment verification.
- The .env.production symlink target was verified as /opt/ids-automate/.env.production; only the symlink was unlinked before removing the worktree.
- Verified the original production env file still exists and git worktree list contains only /opt/ids-automate.

## 2026-11-12 — Instagram-only public onboarding implementation (unverified)

- Public `/setup` signed-out UX alohida IDS email/parol so‘ramasdan official Meta OAuth boshlaydi; UZ/RU/EN matn, Terms/Privacy roziligi, credentialsiz/loading/error va OAuth failure holatlari bor.
- `/`, public header va asosiy CTA’lar `/setup`ga olib boradi. `/login`, `/register`, `/forgot-password`, `/reset-password` va `/verify-email` sahifalari `/setup`ga redirect qiladi. Legacy backend auth va mavjud data/schema olib tashlanmadi.
- API `GET /api/v1/auth/instagram/status` va `POST /api/v1/auth/instagram/start` qo‘shildi. Public callback mavjud Meta redirect URI’ni saqlab, `idsi.` state prefix’i orqali OAuth login’ni legacy account-connect callback’dan ajratadi.
- New OAuth state hashed, 10-minute expiry, one-time consume, terms acceptance, per-state HttpOnly/SameSite=Lax browser-binding cookie va allowed-Origin tekshiruviga ega. Callback official provider token exchange bajaradi, tokenni AES-256-GCM bilan shifrlaydi, session cookie o‘rnatadi va `/setup?step=2&account=...`ga qaytaradi.
- `007_instagram_login.sql` Instagram OAuth state va identity mapping’ni additive qo‘shadi. Mavjud active Instagram account bo‘lsa mapping dastlab uni ulagan user/workspace’ga qo‘yiladi; boshqa workspace claim’ini ko‘chirmaydi. Yangi Instagram identity uchun yangi owner workspace yaratiladi.
- Instagram login user’da synthetic `.invalid` email va random password hash ichki `users` NOT NULL sxemasi uchun ishlatiladi. Email UI’ga ko‘rsatilmaydi, `email_verified_at` soxta belgilanmaydi; session faqat identity mapping borligida email-verification auth gate’dan o‘tadi. Manager/RBAC va tenant membership tekshiruvlari qoladi.
- Settings API/UI login method’ni ko‘rsatadi. Login/register UI’dan Google tugmasi ilgari olib tashlangan, shu patch’da Google backend o‘zgarmadi.
- Avvalgi Instagram-only onboarding patch to‘liq live OAuth bilan qabul qilinmagan. Ushbu auditda production health `ok`, lekin `GET /api/v1/auth/instagram/status` `api_ready=true`, `enabled=false` qaytardi.
- `/opt/ids-automate/.env.production`dagi Meta qiymatlari API konteyneriga mos; Unified Login, Meta bergan Configuration ID va `https://instagram.schat.uz/api/v1/instagram/callback` mosligi tasdiqlandi. Joriy App ID/Secret juftligi Meta credential probe’dan o‘tdi; token javobi ko‘rsatilmagan va saqlanmagan. Avvalgi code 190 boshqa/oldingi secret tekshiruviga tegishli.
- Sabab `MetaOAuthReady` Meta redirect’ni `isAbsoluteURL` bilan tekshirgan; bu umumiy bo‘lmagan helper faqat `/api/v1/auth/google/callback` yo‘lini qabul qilgan. Meta uchun alohida exact Instagram callback + production HTTPS validator qo‘shildi.
- `go test ./...` PASS; `go vet ./...` PASS; `go build ./cmd/server ./cmd/migrate` PASS. Bu testlar real user consent, Instagram asset discovery, webhook yoki DM yuborishni tasdiqlamaydi.
- Commit `f0b7ce2` API image sifatida production’ga deploy qilindi. Oldingi image `ids-automate-api:backup-meta-readiness-20261111T203045Z` tagida rollback uchun saqlandi. Faqat API konteyneri qayta yaratildi; web, PostgreSQL, volume, `.env.production`, Nginx va operator checkout’iga tegilmadi. Yangi schema/migration yo‘q.
- Deploydan keyin `/healthz` `status=ok` qaytardi; ichki va public `GET /api/v1/auth/instagram/status` `api_ready=true`, `enabled=true`, `login_mode=unified` qaytardi. PostgreSQL healthy va avvalgi uptime’ini saqladi.
- Real OAuth consent va `assigned_instagram_accounts` natijasi hali olinmadi. Keyingi qadam: foydalanuvchi `/setup`da Meta oynasini o‘zi tasdiqlashi; agar account list bo‘sh bo‘lsa, configuration asset-sharing va Business Portfolio ruxsatlarini tekshirish. Live Instagram account, webhook va DM **NOT TESTED LIVE**.

## 2026-11-12 — OAuth xatosi bo‘yicha diagnostika patch’i

- Production screenshotida signed-in `/app/accounts` sahifasida `oauth_exchange_failed` ko‘rindi. Bu Meta OAuth callback xato bilan yakunlanganini ko‘rsatadi, ammo eski server kodi token exchange, Instagram asset discovery va webhook subscription xatolarini bitta kodga birlashtirgani uchun sabab bosqichi noma’lum.
- Lokal kod Meta API xatosining bosqichini va faqat HTTP status/Meta numeric code’ni log qiladi. Auth code, token, provider xabar, parol va secretlar logga kiritilmaydi.
- Bo‘sh token, yaroqsiz token JSON, akkaunt ID’siz javob va `subscribed_apps` tasdiqlanmagan javob alohida xatoga ajratildi. Legacy callback bo‘sh account/token bilan account saqlamaydi; UI bosqichga mos UZ/RU/EN yo‘riq beradi.
- Local verification: `go test ./...` PASS; `go vet ./...` PASS; `go build ./cmd/server ./cmd/migrate` PASS; provider/httpapi regression tests PASS; `go test -tags=integration -v ./internal/store` PASS (disposable embedded PostgreSQL); `npm run lint:web` PASS; `npm run test:web` PASS (2/2); `npm run build:web` PASS (22 route); `git diff --check` PASS. Build va PostgreSQL child process Windows sandbox ruxsati sabab eskalatsiya bilan bajarildi.
- Production read-only tekshiruvi: `/healthz` HTTP 200 (`status=ok`, `meta_configured=true`); OAuth status `enabled=true`, `login_mode=unified`, `provider=meta`; `/app/accounts` HTTP 200. Bular sozlama va health holati, haqiqiy OAuth consent yoki Instagram API muvaffaqiyati emas.
- Diagnostika patch’i `d5c1678` release’dan production API va web image’lariga build qilinib chiqarildi. API va web servislar alohida qayta yaratildi; oldingi image’lar `ids-automate-api:backup-oauth-diagnostics-20261112` va `ids-automate-web:backup-oauth-diagnostics-20261112` rollback taglari bilan saqlandi.
- Deploydan keyin ichki va public `/healthz` HTTP 200 (`status=ok`), OAuth status HTTP 200 (`enabled=true`, `login_mode=unified`); `/`, `/setup`, `/app/accounts?error=oauth_token_exchange_failed` HTTP 200 qaytardi. Web static JS ichida yangi stage-specific xato kodlari borligi tekshirildi.
- PostgreSQL container avvalgi `StartedAt` holatini saqladi; schema migration bajarilmadi. Production `.env.production`, Nginx va operator checkout’dagi dirty/untracked fayllarga tegilmadi. Release detached worktree’dan build qilinib keyin olib tashlandi; production root checkout ataylab saqlanib qoldi.
- Production OAuth preflight (2026-11-12): ishga tushgan API `META_LOGIN_MODE=unified`, Meta screenshot’dagi `META_LOGIN_CONFIG_ID=2331645327602552` va `META_REDIRECT_URI=https://instagram.schat.uz/api/v1/instagram/callback` qiymatlarini qaytardi; OAuth status `enabled=true`. Xuddi shu production origin’dan `POST /api/v1/auth/instagram/start` so‘rovini `accept_terms=false` bilan yuborish HTTP 422 `terms_required` qaytardi. Handler rozilik bo‘lmaganda OAuth state saqlashdan oldin to‘xtaydi. Bu marshrut, origin va rozilik nazorati ishlashini tasdiqlaydi, ammo Facebook/Meta OAuth oynasi ochilganini yoki configuration ID Meta’da yaroqliligini tasdiqlamaydi.
- Deploydan keyingi oxirgi 24 soat API loglarida yangi `Instagram login OAuth exchange failed` hodisasi yo‘q edi. `/setup`da rozilik checkbox’i belgilanmagan va davom etish tugmasi o‘chiq edi; shu sabab yangi real Meta callback urinishiga hali dalil yo‘q.
- Bu smoke tekshiruvlar deploy va endpointlar ishlayotganini tasdiqlaydi, OAuth callback’ning real Meta consent’dan keyingi to‘liq muvaffaqiyatini emas. Eski screenshotdagi xato bosqichini orqaga qarab aniqlab bo‘lmaydi; yangi callback bosqichli kodni foydalanuvchi roziligidan keyingina ko‘rsatadi.
- **Live Meta acceptance: NOT TESTED.** Rasmiy consent, Professional account discovery, webhook, real comment, private DM va public reply bo‘yicha dalil olinmagan. Instagram login/paroli ishlatilmagan yoki saqlanmagan. Keyingi qadam — foydalanuvchi o‘z brauzerida Meta oynasidagi shartlar va ruxsatlarga rozilik berishi; so‘ng stage-safe server loglarini tekshirib real acceptance’ni davom ettirish.

## 2026-11-12 — Meta roziligidan keyingi real account-discovery xatosi

- Foydalanuvchi o‘z brauzerida rasmiy Meta oynasidagi rozilikni tasdiqlab qaytdi. Production API loglarida ikkita callback urinishining har ikkalasi `failure_reason=instagram_asset_not_shared` bilan tugagan.
- Amaldagi provider kodi bu xatoni faqat authorization code token bilan almashtirilgach va `GET /me/assigned_instagram_accounts` muvaffaqiyatli HTTP javob bilan 0 ta akkaunt qaytargach beradi. Bu xulosa kod yo‘liga asoslangan; Meta tokenining qiymati yoki xom javobi olinmadi.
- Callback asset topilmagach darhol to‘xtaydi: token encryption/storage, workspace account yozuvi va webhook subscription bajarilmagan. Shu sabab hozir real Instagram akkaunt ulangan emas.
- Production logida bu urinishlar eski diagnostika mapping’i bilan `error_code=provider_error` deb yozilgan. Local patch `ErrInstagramAssetNotShared`ni `asset_discovery_empty` qilib ajratadi; account query `id,username` minimal fields bilan cheklandi. UI UZ/RU/EN’da bo‘sh natijani va Business/Creator, tanlangan Portfolio hamda Meta config asset selection’ni tekshirishni tushuntiradi.
- Local regression/quality gate: `go test ./...` PASS (yangi empty-asset testi bilan), `go vet ./...` PASS, `go build ./cmd/server ./cmd/migrate` PASS, `npm run lint:web` PASS, `npm run test:web` PASS (2/2), `npm run build:web` PASS (22 routes; birinchi Windows sandbox urinishida Next.js standalone fayl nusxalash EPERM berdi, normal process ruxsati bilan qayta ishga tushganda o‘tdi), `git diff --check` PASS.
- Patch `0f22098` commitida GitHub `main`ga push qilindi. Production deploy bajarilmadi: SSH public-key urinish `Permission denied (publickey,password)` bilan rad etildi va serverga kod yozilmadi. Shu sabab production’da yangi UI/xato kodi ishlayapti deb bo‘lmaydi. Live asset-discovery holati muvaffaqiyatsiz; webhook, media, comment event, follower, private reply va public reply **NOT TESTED LIVE**.
- Keyingi live urinishdan avval Meta Business/Instagram’da akkaunt Professional (Business yoki Creator) ekanini, aynan ruxsat berilgan Business Portfolio’da Instagram asset sifatida mavjudligini, Meta config’da shu asset ulashish uchun tanlanganini va zarur permissionlar yoqilganini tekshirish kerak. Parol, token, authorization code, secret yoki URL query string’i yuborilmasin.

