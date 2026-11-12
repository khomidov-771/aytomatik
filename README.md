# IDS Automate

IDS Automate — Instagram Professional akkauntlari uchun real Comment-to-DM avtomatlashtirish platformasi.

Asosiy oqim:

```text
REAL COMMENT → KEYWORD MATCH → OPTIONAL FOLLOW CHECK → PRIVATE REPLY → PUBLIC COMMENT REPLY
```

Public “DM yuborildi” javobi faqat Meta private reply’ni muvaffaqiyatli qabul qilgandan keyin yuboriladi. Follow holati uch qiymatli: `FOLLOWER`, `NOT_FOLLOWER`, `UNKNOWN`. API xatosi yoki yetishmayotgan field hech qachon `NOT_FOLLOWER` deb olinmaydi.

Obuna/to‘lov mahsulot scope’idan chiqarilgan. Product UI/API’da demo rejim, demo akkaunt, fake analytics yoki mock event endpoint yo‘q. Test-only mock adapter faqat `APP_ENV=test` da ishlaydi.

Interfeys O‘zbek, Русский va English tillarida ishlaydi. Til hamda yorug‘/tungi tema public sahifalar, authentication va workspace ichidan almashtiriladi; tanlov browserda saqlanadi.

Automation yaratishda foydalanuvchi Media ID yozmaydi: real OAuth orqali ulangan akkauntning so‘nggi post/Reels’lari rasm, matn va sana bilan Meta API’dan olinadi. Qoida barcha hozirgi/keyingi postlarga yoki foydalanuvchi tanlagan aniq videolarga qo‘llanadi.

## Holat

- **2026-11-12 yangilanishi:** Meta Unified Login orqali `@khomidov_771` production saytga real ulandi. Postlar API’si dastlab HTTP 200 javobidagi Meta timestamp offset formatini o‘qiy olmagan; `+0000` va RFC3339 formatlarini qabul qiladigan tuzatish `009b920` commitida GitHub’ga push qilinib production API’ga chiqarildi. Sahifa yangilangach, real akkauntdan 2 ta post ko‘rsatildi.
- Production `/healthz` HTTP 200 va Instagram OAuth status `api_ready=true`, `enabled=true` qaytardi. Faqat API konteyneri yangilandi; PostgreSQL, web, Nginx, production environment va production checkout o‘z joyida qoldi. Oldingi API image rollback uchun saqlandi.
- Bu natija real OAuth/account discovery va media listni tasdiqlaydi. Signed webhook delivery, follower status, real comment automation, DM send va undan keyingi public reply hali **live test qilinmagan**.
- Backend, frontend va PostgreSQL integratsion testlar lokal muhitda o‘tgan.
- Meta OAuth, webhook, private/public reply va follow requestlari controlled HTTP testlarda tekshirilgan.
- Professional light/dark UI va uch tilli asosiy product oqimlari frontend lint, unit test va production builddan o‘tgan.
- 4 qadamli `/setup` wizard mavjud API’lardan foydalanadi: Meta akkaunt ulash, real post tanlash, keyword/javob sozlash, keyin saqlash va faollashtirish. Demo akkaunt, post yoki analytics ko‘rsatmaydi.
- Google sign-in tugmasi public login/register sahifalaridan olib tashlangan. Server-side Google OAuth backend kodi saqlanadi, lekin joriy public onboarding oqimiga ulanmagan.
- Google OAuth server-side authorization-code/OIDC, PKCE, signed ID-token va Postgres account linking oqimi kodga qo‘shilgan; disposable PostgreSQL va controlled OIDC server bilan tekshirilgan.
- Google OAuth kodi GitHub `main` va production serverga `8c15cde` commitida deploy qilindi. Production `GET /api/v1/auth/google/status` HTTP 200 bilan `enabled=false`, credentialsiz start esa HTTP 503 qaytardi. Google Cloud Client ID/Secret production serverga qo‘yilib, real Google browser flow qabul qilinmaguncha real Google sign-in **ishlamaydi**.
- Avvalgi Meta consent urinishlari `assigned_instagram_accounts`dan bo‘sh ro‘yxat olgan. Keyingi urinishda foydalanuvchi Professional akkauntni tanlagach ulanish muvaffaqiyatli tugadi; account va token keyingi media chaqiruvida ishladi.
- Empty-asset diagnostics `0f22098`da, Meta media timestamp tuzatishi `009b920`da GitHub `main`ga push qilindi. Production API `009b920` manbasidan alohida release worktree orqali build qilindi; operator checkout’iga `pull/reset/clean` ishlatilmadi.
- Meta bergan Unified Login Configuration ID `.env.example`da public konfiguratsiya sifatida ko‘rsatilgan. Secretlar repositoryga yozilmaydi.

Avvalgi tekshiruvda boshqa Meta App Secret `OAuthException` code `190` bilan rad etilgan edi. Joriy serverdagi juftlik credential probe’dan o‘tdi. Bu foydalanuvchi roziligi bilan OAuth, asset sharing yoki live Comment-to-DM muvaffaqiyatini isbotlamaydi.

Batafsil: [PROJECT_STATUS.md](docs/PROJECT_STATUS.md), [NEXT_STEPS.md](docs/NEXT_STEPS.md), [AI_HANDOFF.md](docs/AI_HANDOFF.md).

## Texnologiyalar

- Frontend: Next.js 16 App Router, React 19, TypeScript, custom CSS
- Backend: Go, `net/http`, pgx
- Database: PostgreSQL 17
- Queue: PostgreSQL durable queue; Redis faqat wake-up signal
- Auth: Meta/Instagram OAuth for public onboarding, HttpOnly session cookie, CSRF and workspace RBAC; legacy email/password backend retained for compatibility, but its public pages redirect to setup
- Optional Google OAuth backend: server-side OAuth 2.0 / OpenID Connect; not exposed by the current public login/register UI
- Meta: Instagram Login yoki Unified/Facebook Login konfiguratsiyasi

## Talablar

- Go toolchain (repositorydagi `api/go.mod`ga mos)
- Node.js 20+ va npm
- PostgreSQL 17+
- Redis 7+ tavsiya qilinadi
- Real ishlash uchun Meta App credentials va Professional Business/Creator akkaunt

## O‘rnatish

```powershell
git clone <repository-url>
cd IDS_Automate_Codex_Pack
Copy-Item .env.example .env
npm ci
cd api
go mod download
cd ..
```

`.env` ichida kamida database, security va Meta qiymatlarini to‘ldiring. Secretlarni commit qilmang.

Google OAuth backend kodi qolgan, lekin current public login/register sahifalarida Google tugmasi yo‘q. Faqat Google OAuth’ni alohida qayta faollashtirish talabi bo‘lsa, Google Cloud Console’da OAuth Client ID (Web application) yarating, local va production callback manzillarini Authorized redirect URIs ro‘yxatiga qo‘shing hamda server `.env`iga `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET`ni kiriting. Callback qiymati Google Cloud’dagi qiymat bilan aynan bir xil bo‘lishi shart:

```text
Local:      http://localhost:8080/api/v1/auth/google/callback
Production: https://instagram.schat.uz/api/v1/auth/google/callback
```

`GOOGLE_REDIRECT_URL` berilmasa, backend `API_URL`dan callback manzilini hosil qiladi. Production’da `API_URL` public HTTPS origin bo‘lishi kerak. Sozlamadan so‘ng API container’ni qayta ishga tushiring. `GET /api/v1/auth/google/status` faqat OAuth yoqilgan/yoqilmagan holatini beradi; status `enabled` bo‘lishi Google real login muvaffaqiyatli degani emas. Real tekshiruv uchun Google consent oynasi, callback, database identity link va session’ni production’da sinash kerak. Client Secret hech qachon frontend, Git yoki chatga qo‘yilmaydi.

Security qiymatlarini yaratish misoli:

```powershell
# SESSION_SECRET uchun kamida 32 belgilik random qiymat ishlating.
# TOKEN_ENCRYPTION_KEY base64 formatidagi aynan 32 byte bo‘lishi kerak.
```

## Ishga tushirish

### Docker Compose

```powershell
docker compose up --build
```

Manzillar:

- Web: `http://localhost:3000`
- API: `http://localhost:8080`
- Health: `http://localhost:8080/healthz`

Meta credentials bo‘lmasa development UI/API ishga tushadi, ammo Instagram ulash va webhook integratsiyasi aniq `sozlanmagan` holatda bloklanadi. Production credentialsiz start qilmaydi va hech qachon mock rejimga avtomatik o‘tmaydi.
Non-empty placeholder qiymatlar ham `meta_configured=true` deb ko‘rsatilmaydi; App ID/config ID numeric va server-only secretlar production credentialga o‘xshash bo‘lishi kerak. Haqiqiy tekshiruv OAuth/Meta API success bilan yakunlanadi.

### Servislarni alohida ishga tushirish

```powershell
# 1. PostgreSQL va Redis
docker compose up -d postgres redis

# 2. Migration
cd api
go run ./cmd/migrate up

# 3. API
go run ./cmd/server

# 4. Boshqa terminalda frontend
cd ..
npm run dev:web
```

## Meta sozlamalari

1. Meta App’da Instagram Professional asset va kerakli mahsulotlarni ulang.
2. Redirect URI’ni `.env`dagi `META_REDIRECT_URI` bilan aynan moslang.
3. Webhook callback: `${API_URL}/api/v1/webhooks/instagram`.
4. Verify token va App Secret’ni server environment’iga kiriting.
5. Login yo‘lini tanlang:
   - `META_LOGIN_MODE=instagram`: Instagram Login; follow field faqat kerakli messaging context/ruxsatlarda mavjud bo‘lsa tekshiriladi.
   - `META_LOGIN_MODE=unified`: Unified/Facebook Login; hozirgi implementatsiya follow checkni `UNKNOWN` qiladi, chunki `is_user_follow_business` bu yo‘lda live tasdiqlanmagan.
6. Amaldagi ruxsatlar login yo‘liga qarab tekshiriladi. Instagram Login uchun kod `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages` bilan ishlaydi.

Commentning o‘zi profile/follow tekshiruviga yetarli permission yoki messaging context borligini anglatmaydi.

## Onboarding oqimi

Public **Boshlash** tugmasi `/setup`ni ochadi. Alohida IDS email/paroli talab qilinmaydi. Foydalanuvchi shartlarni qabul qilib rasmiy Meta/Instagram OAuth oynasida o‘z Professional akkauntini tasdiqlaydi. Server OAuth state’i browser binding cookie bilan tekshiradi, tokenni AES-256-GCM bilan shifrlaydi, Instagram identity’ni workspace’ga bog‘laydi va HttpOnly session cookie yaratadi. Callback’dan keyin ulangan account ID bilan wizard’ning video tanlash bosqichi ochiladi.

1. `GET /api/v1/auth/instagram/status` serverdagi OAuth sozlamasi bilan boshlash mumkinligini ko‘rsatadi; bu Meta credentials haqiqiyligini yoki live integratsiyani tasdiqlamaydi. `POST /api/v1/auth/instagram/start` terms roziligi, `Origin`, bir martalik state va 10 daqiqalik browser binding bilan rasmiy OAuth’ni boshlaydi.
2. Ulangan akkauntning postlari `GET /instagram/accounts/{id}/media` orqali olinadi; foydalanuvchi barcha eligible postlarni yoki aniq postlarni tanlaydi.
3. Kalit so‘z, moslik usuli, private DM, public javob, ixtiyoriy follow check va UNKNOWN fallback kiritiladi.
4. Foydalanuvchi qoidani ko‘rib, faol yoki o‘chiq holda saqlaydi. Muvaffaqiyat faqat `POST /automations` automation ID qaytarganidan keyin ko‘rsatiladi.

Meta callback URI o‘zgarmaydi. Birinchi marta OAuth qilgan foydalanuvchiga alohida workspace yaratiladi. Avval IDS orqali ulangan Instagram account bo‘lsa, identity uni dastlab ulangan workspace va user’iga bog‘laydi. Boshqa workspace tomonidan faol claim qilingan account yangi workspace’ga berilmaydi. `/login`, `/register`, parol tiklash va email tasdiqlash sahifalari `/setup`ga qaytaradi; legacy API va database foydalanuvchilari data-preservation uchun qoldirilgan.

OAuth statusi sozlamalarning boshlashga yaroqliligini bildiradi, haqiqiy Meta foydalanuvchi roziligi yoki asset ulanishini emas. Joriy server App ID/Secret juftligi Meta credential probe’dan o‘tdi; OAuth consent, account/media list, webhook va DM delivery alohida live acceptance talab qiladi.

Unified Login `assigned_instagram_accounts` javobida `account_type` maydoni bo‘lmagani uchun yangi akkauntning subtype qiymati `UNKNOWN` bo‘lib saqlanadi va UI noaniqlikni ochiq ko‘rsatadi.

## Environment variables

| Nomi | Maqsad |
|---|---|
| `APP_ENV` | `development`, `test`, `production` |
| `APP_URL` | Frontend public URL |
| `API_URL` | Backend public URL |
| `PORT` | API port |
| `DATABASE_URL` | PostgreSQL DSN |
| `REDIS_URL` | Redis URL; wake-up signal uchun |
| `SESSION_SECRET` | Session himoyasi, productionda 32+ belgi |
| `TOKEN_ENCRYPTION_KEY` | Access token uchun base64 32-byte AES key |
| `COOKIE_SECURE` | Productionda `true` |
| `ALLOWED_ORIGINS` | CORS allowlist |
| `TRUSTED_PROXY_CIDRS` | Ishonchli reverse proxy tarmoqlari |
| `INSTAGRAM_PROVIDER` | Productda `meta`; `mock` faqat testda |
| `META_APP_ID` | Meta App ID |
| `META_APP_SECRET` | Meta App Secret |
| `META_API_VERSION` | Graph API versiyasi |
| `META_LOGIN_MODE` | `instagram` yoki `unified` |
| `META_LOGIN_CONFIG_ID` | Unified Login configuration ID |
| `META_REDIRECT_URI` | OAuth callback URI |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook verify token |
| `META_WEBHOOK_APP_SECRET` | `X-Hub-Signature-256` tekshiruvi |
| `GOOGLE_CLIENT_ID` | Ixtiyoriy backend Google OAuth Web Client ID; public onboarding UI’da tugma yo‘q |
| `GOOGLE_CLIENT_SECRET` | Ixtiyoriy backend Google OAuth Client Secret; faqat serverda saqlanadi |
| `GOOGLE_REDIRECT_URL` | Ixtiyoriy backend Google callback; bo‘sh bo‘lsa `API_URL`dan hosil qilinadi |
| `NEXT_PUBLIC_API_URL` | Frontend ishlatadigan API base URL |
| `MAIL_PROVIDER` | `log` developmentda, `smtp` productionda |
| `MAIL_*` | SMTP sozlamalari |

To‘liq, secretsiz namuna: [.env.example](.env.example).

## Komandalar

```powershell
# Frontend
npm run dev:web
npm run lint:web
npm run test:web
npm run build:web

# Backend (api papkasida)
go test ./...
go vet ./...
go build ./cmd/server ./cmd/migrate
go run ./cmd/migrate up

# PostgreSQL integration
go test -tags=integration -v ./internal/store

# Barcha standart frontend gate’lari
npm test
```

## 2026-11-12 production deploy

Frontend redesign commit e90505a GitHub main’ga push qilindi va production’da faqat web service yangilandi. /, /setup, login, register va /healthz HTTP 200 qaytardi; API ishlayapti, PostgreSQL healthy. Real Meta OAuth, webhook, follow-check va DM oqimlari valid App credentials hamda eligible account bilan live acceptance o‘tmaguncha tayyor deb hisoblanmaydi. Batafsil: docs/PROJECT_STATUS.md.
## Mahalliy ishlab chiqish qoidalari

- Schema o‘zgarishi faqat yangi additive migration orqali qilinadi.
- Tenant query’lari `workspace_id` bilan cheklanadi.
- Provider side effect oldidan idempotency action marker yoziladi.
- Private reply noaniq natija bersa blind retry qilinmaydi.
- Faqat aniq retryable public reply xatosi maksimal uch urinishgacha qayta ishlanishi mumkin.
- Controlled/mock test natijasini live Meta natijasi deb yozmang.

## Repository tuzilishi

```text
api/                  Go API, worker, provider, store va migrations
web/                  Next.js frontend
docs/                 arxitektura, status, handoff va operatsion hujjatlar
deploy/               nginx konfiguratsiyasi
docker-compose.yml    local stack
docker-compose.prod.yml production stack
```

## Muhim hujjatlar

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md)
- [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
- [NEXT_STEPS.md](docs/NEXT_STEPS.md)
- [AI_HANDOFF.md](docs/AI_HANDOFF.md)
- [META_SETUP_CHECKLIST.md](docs/META_SETUP_CHECKLIST.md)

### 2026-11-12 OAuth xato tekshiruvi

OAuth callback diagnostikasi `d5c1678` release’dan production API va web servislariga chiqarildi. Health, OAuth status va muhim sahifalar HTTP 200 qaytardi; PostgreSQL konteyneri qayta yaratilmagan va ma’lumotlar saqlangan. Same-origin OAuth start preflight rozilik belgilanmaganda kutilgan HTTP 422 `terms_required` qaytardi, shuning uchun Meta OAuth oynasi hali ishga tushirilmagan. Real Meta consent, Instagram account discovery, webhook va DM **live tasdiqlanmagan**: foydalanuvchi `/setup`da shartlarni o‘zi qabul qilib, keyin rasmiy Meta oynasidagi ulanishni yakunlab callback’ga qaytishi kerak. Instagram parolini agentga yubormang. Batafsil: [PROJECT_STATUS.md](docs/PROJECT_STATUS.md), [NEXT_STEPS.md](docs/NEXT_STEPS.md).

