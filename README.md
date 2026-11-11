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

- Backend, frontend va PostgreSQL integratsion testlar lokal muhitda o‘tgan.
- Meta OAuth, webhook, private/public reply va follow requestlari controlled HTTP testlarda tekshirilgan.
- Professional light/dark UI va uch tilli asosiy product oqimlari frontend lint, unit test va production builddan o‘tgan.
- 4 qadamli `/setup` wizard mavjud API’lardan foydalanadi: Meta akkaunt ulash, real post tanlash, keyword/javob sozlash, keyin saqlash va faollashtirish. Demo akkaunt, post yoki analytics ko‘rsatmaydi.
- Google sign-in tugmasi public login/register sahifalaridan olib tashlangan. Server-side Google OAuth backend kodi saqlanadi, lekin joriy public onboarding oqimiga ulanmagan.
- Google OAuth server-side authorization-code/OIDC, PKCE, signed ID-token va Postgres account linking oqimi kodga qo‘shilgan; disposable PostgreSQL va controlled OIDC server bilan tekshirilgan.
- Google OAuth kodi GitHub `main` va production serverga `8c15cde` commitida deploy qilindi. Production `GET /api/v1/auth/google/status` HTTP 200 bilan `enabled=false`, credentialsiz start esa HTTP 503 qaytardi. Google Cloud Client ID/Secret production serverga qo‘yilib, real Google browser flow qabul qilinmaguncha real Google sign-in **ishlamaydi**.
- Production auditda joriy Meta App Secret Meta tomonidan rad etildi (`OAuthException`, code `190`); real connected Instagram akkaunt, active rule va webhook event yo‘q. Shu sabab live OAuth, live webhook, `is_user_follow_business`, real private reply va public reply **live tekshirilmagan**.
- Meta bergan Unified Login Configuration ID `.env.example`da public konfiguratsiya sifatida ko‘rsatilgan. Secretlar repositoryga yozilmaydi.

Joriy Meta App Secret avvalgi production tekshiruvda Graph API tomonidan `OAuthException` code `190` bilan rad etilgan. Shu sabab live Instagram OAuth va Comment-to-DM oqimi bu controlled test natijalaridan kelib chiqib tayyor deb hisoblanmaydi.

Batafsil: [PROJECT_STATUS.md](docs/PROJECT_STATUS.md), [NEXT_STEPS.md](docs/NEXT_STEPS.md), [AI_HANDOFF.md](docs/AI_HANDOFF.md).

## Texnologiyalar

- Frontend: Next.js 16 App Router, React 19, TypeScript, custom CSS
- Backend: Go, `net/http`, pgx
- Database: PostgreSQL 17
- Queue: PostgreSQL durable queue; Redis faqat wake-up signal
- Auth: HttpOnly session cookie, CSRF, email verification, RBAC
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

Public sahifadagi **Boshlash** tugmasi email/parol orqali IDS Automate workspace’iga olib kiradi. Email tasdiqlanib hisobga kirilgach `/setup` sahifasida:

1. Serverdagi Meta konfiguratsiya holati tekshiriladi va foydalanuvchi rasmiy Meta OAuth orqali akkaunt ulaydi.
2. Ulangan akkauntning postlari `GET /instagram/accounts/{id}/media` orqali olinadi; foydalanuvchi barcha eligible postlarni yoki aniq postlarni tanlaydi.
3. Kalit so‘z, moslik usuli, private DM, public javob, ixtiyoriy follow check va UNKNOWN fallback kiritiladi.
4. Foydalanuvchi qoidani ko‘rib, faol yoki o‘chiq holda saqlaydi. Muvaffaqiyat faqat `POST /automations` automation ID qaytarganidan keyin ko‘rsatiladi.

Meta callback URI o‘zgarmaydi. OAuth’dan qaytgach `/app/accounts?connected=1` sahifasidagi **Sozlashni davom ettirish** havolasi tanlangan akkaunt bilan wizard’ning 2-bosqichini ochadi. Workspace session bo‘lmasa foydalanuvchi login/register’ga yo‘naltiriladi.

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
