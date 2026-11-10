# Project status

Tekshiruv: 2026-11-11. Branch: `main`; audit hujjatlari commit `4218851`, production’ga deploy qilingan Google OAuth kod commit `8c15cde`. Holat repository kodi, shu muhitda bajarilgan testlar va production serverdagi endpoint/container tekshiruvlariga asoslangan.

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
| 6 | Frontend production build | PASS | Next.js 21 route build |
| 7 | PostgreSQL migrations/integration | PASS | embedded PostgreSQL 18.6.1, `TestTenantTokensInboxAndQueue` |
| 8 | Auth/session/CSRF | PASS controlled | Unit/integration coverage |
| 9 | Multi-tenant isolation | PASS controlled | Cross-tenant account/execution/action negative checks |
| 10 | OAuth/token/webhook request logic | PASS controlled | Provider/security tests; no live Meta |
| 11 | Comment-to-DM decision matrix | PASS controlled | Worker tests cover disabled/follower/not-follower/UNKNOWN policies |
| 12 | Action idempotency/history | PASS controlled | PostgreSQL action ledger retry/dedup/history test |
| 13 | Live Meta OAuth | BLOCKED | App ID/App Secret/test asset yo‘q |
| 14 | Live signed webhook receive | BLOCKED | Public HTTPS Meta subscription yo‘q |
| 15 | Live follow verification | BLOCKED | Eligible Instagram Login messaging context yo‘q |
| 16 | Live private reply | BLOCKED | Real comment/access token yo‘q |
| 17 | Live public reply and ordering | BLOCKED | Real private-reply success event yo‘q |

## Modul holati

| Modul | Haqiqiy holat |
|---|---|
| Registration/login/email verification/reset | Implemented va controlled testdan o‘tgan |
| Session/CSRF/RBAC/workspace switch | Implemented va controlled testdan o‘tgan |
| Multi-tenant store | Implemented; cross-tenant negative integration test bor |
| Instagram account UI | Real OAuth-only; demo account yaratmaydi |
| Instagram Login adapter | Kod va controlled HTTP test bor; live tekshirilmagan |
| Unified Login adapter | Auth URL, exchange, assigned asset, subscription controlled test bor; live tekshirilmagan |
| Token encryption | AES-256-GCM implementation/test bor; real token saqlanmagan |
| Webhook verify/parser | HMAC va Meta-shaped payload controlled test bor; live payload tekshirilmagan |
| Automation builder | Account/keyword/templates/follow/fallback/active fields ishlaydi. Raw Media ID olib tashlangan; real connected account uchun Meta media edge’dan post/Reels preview tanlovi qo‘shilgan. Provider request controlled testdan o‘tgan, live token bilan hali tekshirilmagan |
| Follow tri-state | Implemented. Unified → UNKNOWN. Instagram Login field/error semantics controlled testda |
| Private reply | Official endpoint adapter va state machine implemented; live tekshirilmagan |
| Public comment reply | Private successdan keyingi branch implemented; live tekshirilmagan |
| Idempotency/retry | Event, action va manual message markerlar implemented; DB testdan o‘tgan |
| Execution history | API + UI implemented; actionlar alohida ko‘rinadi |
| Inbox | Inbound store/manual reply window implemented; live DM tekshirilmagan |
| Analytics | Database’dagi real event/actionlardan hisoblanadi; fake seed yo‘q |
| UI/lokalizatsiya | UZ/RU/EN tanlovi va light/dark tema public, auth va workspace sahifalariga ulangan; browserda saqlanadi. Workspace typography/spacing professional o‘lchamga oshirildi, birinchi kirish uchun real holatga asoslangan 3 bosqichli onboarding qo‘shildi. Native browser dropdownlari yagona accessible custom menu bilan almashtirildi. Landing scroll-reveal va workspace micro-interaction motion tizimi `prefers-reduced-motion` bilan qo‘shildi |
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
- Login va registration sahifalariga UZ/RU/EN Google holati va tugmasi qo‘shildi; registration Terms roziligini talab qiladi.

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
