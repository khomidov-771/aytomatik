# IDS Automate

IDS Automate — Instagram Professional akkauntlari uchun multi-tenant comment-to-DM SaaS. Foydalanuvchi emailini tasdiqlaydi, workspace yaratadi yoki taklif orqali qo‘shiladi, Instagram akkauntini OAuth bilan ulaydi, comment qoidalarini boshqaradi va ruxsat etilgan private reply’larni yuboradi. Inbox, 24 soatlik inbound-message reply oynasi, analytics, RBAC, audit, session management va aniq belgilangan Mock Mode mavjud.

Loyiha joylashuvi: `C:\Users\secre\Desktop\1\IDS_Automate_Codex_Pack`.

Meta bergan Unified Login Configuration ID `2331645327602552` kodga ulangan. Unified authorization URL, token exchange, assigned-account discovery, webhook subscription va delivery ketma-ketligi deterministik HTTP test bilan o‘tdi. Biroq App ID/App Secret, tasdiqlangan Professional akkaunt va App Review dalili bo‘lmagani sababli real Instagram integratsiyasi “live tekshirildi” deb hisoblanmaydi. Mock Mode haqiqiy Instagram delivery emas va UI’da `Demo mode` bilan belgilanadi.

## Stack

- Frontend: Next.js 16, React 19, TypeScript, Vitest, ESLint.
- Backend: Go 1.27, `net/http`, pgx, Redis client.
- Data: PostgreSQL 17, Redis 7 (signal/acceleration; database queue source of truth).
- Security: HttpOnly session cookie, CSRF, RBAC, AES-256-GCM token encryption, OAuth state, webhook HMAC, SMTP STARTTLS.

## Tez ishga tushirish — Docker Compose

Talablar: Docker Desktop va Docker Compose.

```powershell
Set-Location C:\Users\secre\Desktop\1\IDS_Automate_Codex_Pack
Copy-Item .env.example .env
docker compose up --build -d
docker compose exec api /ids-seed
docker compose logs -f api web
```

Ochish:

- Web: `http://localhost:3000`
- API health: `http://localhost:8080/healthz`
- Seed qilingan dev login: `demo@ids.uz` / `Demo1234!`

`.env` ichidagi development qiymatlari production uchun yaroqsiz. Real secretlarni repository’ga commit qilmang.

## Lokal development

1. PostgreSQL va ixtiyoriy Redis’ni ishga tushiring.
2. `.env.example` dan `.env` yarating va environment’ga yuklang.
3. Frontend dependency’larini o‘rnating.
4. API va web’ni alohida terminallarda ishga tushiring.

```powershell
# Repository root
npm ci

# Terminal 1 — API
Set-Location api
go run ./cmd/server

# Terminal 2 — Web
Set-Location web
npm run dev
```

Bu workspace’da system Go bo‘lmasa, saqlangan toolchain ishlatiladi:

```powershell
Set-Location api
$env:GOMODCACHE=(Resolve-Path '..\.tools').Path+'\gomodcache'
$env:GOCACHE=(Resolve-Path '..\.tools').Path+'\gocache'
& '..\.tools\go\bin\go.exe' run ./cmd/server
```

API server startup’da barcha yangi SQL migration’larni qo‘llaydi. Demo seed:

```powershell
Set-Location api
go run ./cmd/seed
```

## Asosiy komandalar

```powershell
# Frontend
Set-Location web
npm run dev
npm run lint
npm test -- --run
npm run build
npm run test:e2e
npm run start

# Backend
Set-Location api
go test ./...
go vet ./...
go build ./cmd/server ./cmd/migrate ./cmd/seed

# PostgreSQL integration suite (alohida test database talab qiladi)
$env:IDS_TEST_DATABASE_URL='postgres://user:pass@localhost:5432/ids_automate_test?sslmode=disable'
go test -tags=integration -v ./internal/store
```

Rootdagi `npm test` frontend lint + unit test + production buildni ketma-ket bajaradi. Windows sandbox’da standalone copy `EPERM` bersa, buildni oddiy terminalda ishga tushiring; 2026-11-09 da ayni revision sandbox tashqarisida muvaffaqiyatli build bo‘lgan. Joriy unit/integration/E2E dalillari [Test report](./docs/TEST_REPORT.md) da.

## Environment variables

| Nom | Vazifa | Production |
|---|---|---|
| `APP_ENV` | `development` yoki `production` | `production` |
| `APP_URL` | Frontend public URL | Majburiy |
| `API_URL` | Backend public URL | Majburiy |
| `PORT` | API port | Ixtiyoriy, default `8080` |
| `DATABASE_URL` | PostgreSQL DSN | Majburiy |
| `REDIS_URL` | Redis DSN; bo‘lmasa DB + in-process signal ishlaydi | Tavsiya qilinadi |
| `SESSION_SECRET` | Kamida 32 belgili session secret | Majburiy |
| `TOKEN_ENCRYPTION_KEY` | Base64 kodlangan 32 byte AES key | Majburiy |
| `COOKIE_SECURE` | HTTPS cookie flag | `true` |
| `ALLOWED_ORIGINS` | Vergul bilan CORS origin’lar | Majburiy |
| `INSTAGRAM_PROVIDER` | `mock` yoki `meta` | Majburiy |
| `META_APP_ID` | Meta App ID | `meta` rejimda majburiy |
| `META_APP_SECRET` | Meta App Secret | `meta` rejimda majburiy |
| `META_API_VERSION` | Graph API versiyasi | Rasmiy hujjat bilan tekshiring |
| `META_LOGIN_MODE` | `unified` yoki eski `instagram` OAuth oqimi | Yangi Meta konfiguratsiya uchun `unified` |
| `META_LOGIN_CONFIG_ID` | Meta Login for Business Configuration ID; secret emas | `unified` rejimda majburiy |
| `META_REDIRECT_URI` | OAuth callback | `meta` rejimda majburiy |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook verify token | `meta` rejimda majburiy |
| `META_WEBHOOK_APP_SECRET` | HMAC app secret | `meta` rejimda majburiy |
| `MAIL_PROVIDER` | `log` yoki `smtp` | `smtp` majburiy |
| `MAIL_FROM` | RFC 5322 sender | Majburiy |
| `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT` | SMTP server | Majburiy |
| `MAIL_SMTP_USER`, `MAIL_SMTP_PASSWORD` | SMTP auth | Providerga bog‘liq |
| `MAIL_SMTP_STARTTLS` | STARTTLS talabi | `true` majburiy |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL; bo‘lmasa same-origin `/api/v1` | Alohida origin bo‘lsa majburiy |
| `IDS_TEST_DATABASE_URL` | Faqat integration test DB | Testda |

To‘liq namesiz namuna: [.env.example](./.env.example).

Production `.env.production` ichida `INSTAGRAM_PROVIDER=meta`, `META_LOGIN_MODE=unified` va `META_LOGIN_CONFIG_ID=2331645327602552` ishlatiladi. Haqiqiy App Secret/webhook/SMTP secretlarni repository’ga yozmang. VPS tartibi [Deployment](./docs/DEPLOYMENT.md) da.

## Mock Mode end-to-end oqimi

1. `INSTAGRAM_PROVIDER=mock` bilan tizimni ishga tushiring.
2. Email verification’ni dev response’dagi havola bilan yakunlang yoki seed login’dan foydalaning.
3. Instagram akkauntlar sahifasida mock OAuth’ni tugating.
4. Automation qoidasini yarating.
5. `Mock laboratoriya`da comment yuboring — private reply yaratiladi, lekin manual reply oynasi ochilmaydi.
6. Xuddi shu participant uchun inbound DM yuboring — Inbox’da 24 soatlik manual reply oynasi ochiladi.
7. Bir xil comment/message ID takror yuborilsa idempotency duplicate’ni bloklaydi.

## Muhim hujjatlar

- [Architecture](./docs/ARCHITECTURE.md)
- [Project status va test dalillari](./docs/PROJECT_STATUS.md)
- [Qolgan ishlar](./docs/NEXT_STEPS.md)
- [AI handoff](./docs/AI_HANDOFF.md)
- [Meta setup checklist](./docs/META_SETUP_CHECKLIST.md)
- [VPS deployment](./docs/DEPLOYMENT.md)
- [Test report](./docs/TEST_REPORT.md)
- [Technical specification](./docs/TECHNICAL_SPEC.md)
- [Design guide](./docs/DESIGN_GUIDE.md)

## Hozirgi chegaralar

- Real Meta OAuth/webhook/delivery real credential va App Review bilan bajarilmagan; faqat kontrollangan provider HTTP simulyatsiyasi o‘tgan.
- Ayni revisionning PostgreSQL integration suite’i ajratilgan disposable PostgreSQL 18 bazasida o‘tgan. Docker CLI kompyuterda yo‘qligi sabab Compose runtime tekshirilmagan.
- Playwright critical flow Mock Mode’da o‘tgan: register/verify/login/logout, duplicate comment, inbound DM va manual Inbox reply. Bu real Meta testi emas.
- SMTP adapter mavjud, ammo real SMTP server bilan delivery testi bajarilmagan.
- Meta Unified Login kodi berilgan `Configuration ID` bilan sozlangan, ammo App ID/App Secret, tasdiqlangan professional akkaunt va App Review bo‘lmagani uchun real OAuth/webhook/delivery tekshirilmagan.
- Data deletion hozir xavfsiz `pending_manual_review`; avtomatik o‘chirish retention/legal qarorisiz yoqilmagan.
- Campaign sahifasi alohida campaign entity emas; akkaunt bo‘yicha automation jamlanmasi ekanini ochiq yozadi. CSV optional va hozir disabled.
- Production npm dependency auditida 0 vulnerability; to‘liq auditda ESLint dev-only zanjirida 8 moderate `minimatch` finding qolgan. Npm faqat breaking `--force` downgrade taklif qilgan.
