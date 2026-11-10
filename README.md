# IDS Automate

IDS Automate — Instagram Professional akkauntlari uchun real Comment-to-DM avtomatlashtirish platformasi.

Asosiy oqim:

```text
REAL COMMENT → KEYWORD MATCH → OPTIONAL FOLLOW CHECK → PRIVATE REPLY → PUBLIC COMMENT REPLY
```

Public “DM yuborildi” javobi faqat Meta private reply’ni muvaffaqiyatli qabul qilgandan keyin yuboriladi. Follow holati uch qiymatli: `FOLLOWER`, `NOT_FOLLOWER`, `UNKNOWN`. API xatosi yoki yetishmayotgan field hech qachon `NOT_FOLLOWER` deb olinmaydi.

Obuna/to‘lov mahsulot scope’idan chiqarilgan. Product UI/API’da demo rejim, demo akkaunt, fake analytics yoki mock event endpoint yo‘q. Test-only mock adapter faqat `APP_ENV=test` da ishlaydi.

Interfeys O‘zbek, Русский va English tillarida ishlaydi. Til hamda yorug‘/tungi tema public sahifalar, authentication va workspace ichidan almashtiriladi; tanlov browserda saqlanadi.

## Holat

- Backend, frontend va PostgreSQL integratsion testlar lokal muhitda o‘tgan.
- Meta OAuth, webhook, private/public reply va follow requestlari controlled HTTP testlarda tekshirilgan.
- Professional light/dark UI va uch tilli asosiy product oqimlari frontend lint, unit test va production builddan o‘tgan.
- Real Meta App credentials va eligible Instagram Professional akkaunt bu workspace’da yo‘q. Shu sabab live OAuth, live webhook, `is_user_follow_business`, real private reply va public reply **live tekshirilmagan**.
- Meta bergan Unified Login Configuration ID `.env.example`da public konfiguratsiya sifatida ko‘rsatilgan. Secretlar repositoryga yozilmaydi.

Batafsil: [PROJECT_STATUS.md](docs/PROJECT_STATUS.md), [NEXT_STEPS.md](docs/NEXT_STEPS.md), [AI_HANDOFF.md](docs/AI_HANDOFF.md).

## Texnologiyalar

- Frontend: Next.js 16 App Router, React 19, TypeScript, custom CSS
- Backend: Go, `net/http`, pgx
- Database: PostgreSQL 17
- Queue: PostgreSQL durable queue; Redis faqat wake-up signal
- Auth: HttpOnly session cookie, CSRF, email verification, RBAC
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
