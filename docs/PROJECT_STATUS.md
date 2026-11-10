# Project status

Tekshiruv: 2026-11-10. Branch: `main`. Holat faqat repository kodi va shu muhitda bajarilgan testlarga asoslangan.

## Umumiy natija

Tekshiriladigan 17 gate’dan 12 tasi o‘tdi, 5 ta live Meta gate credential/eligible account yo‘qligi sabab bloklangan: **70.6% verified readiness**.

Bu product completion foizi emas. Kod tayyorligi yuqoriroq, lekin core biznes qiymatining live Meta dalili mavjud bo‘lmaguncha loyiha “to‘liq tayyor” emas.

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
| UI/lokalizatsiya | UZ/RU/EN tanlovi va light/dark tema public, auth va workspace sahifalariga ulangan; browserda saqlanadi. Workspace typography/spacing professional o‘lchamga oshirildi, birinchi kirish uchun real holatga asoslangan 3 bosqichli onboarding qo‘shildi |
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
