# AGENTS.md — IDS Automate

Bu fayl Claude Code, Cursor, Codex va boshqa coding agentlar uchun majburiy repository qoidalaridir.

## Ishni boshlash tartibi

1. To‘liq o‘qing: `README.md`, `docs/AI_HANDOFF.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_STEPS.md`, `docs/ARCHITECTURE.md`, `docs/TECHNICAL_SPEC.md` va `.codex/skills/ids-automate/SKILL.md`.
2. `rg --files -g "!node_modules" -g "!.next" -g "!.tools"` bilan repository inventarini tekshiring.
3. Mavjud kodni qayta yozmang. Eng kichik, tekshiriladigan patch bilan ishlang.
4. `docs/PROJECT_STATUS.md`dagi ma’lum xatolarni qayta tasdiqlang; eski `docs/IMPLEMENTATION_STATUS.md`ni source of truth deb olmang.
5. Git tarixini tekshiring, lekin user o‘zgarishlarini yo‘qotadigan reset/checkout ishlatmang.

## Mahsulotning o‘zgarmas qoidalari

- Faqat Instagram Professional (Business/Creator) va rasmiy Meta API.
- Scraping, browser automation, Instagram parolini yig‘ish yoki unofficial endpoint taqiqlanadi.
- Product UI/API’da demo yoki mock rejim yo‘q. `Mock` provider faqat `APP_ENV=test` bo‘lgan avtomatik testlarda ishlatilishi mumkin.
- Real Meta integratsiya faqat haqiqiy authorized API call muvaffaqiyatli bo‘lgandan keyin “ishlaydi” deb yoziladi.
- Asosiy oqim: comment → keyword → optional follow check → private reply → faqat tasdiqlangan DM’dan keyin public success reply.
- Follow natijasi faqat `FOLLOWER`, `NOT_FOLLOWER` yoki `UNKNOWN`; xato/missing field hech qachon `NOT_FOLLOWER` emas.
- Private reply va follow-up messaging policy fail-closed bo‘lishi shart. User reply webhooki tasdiqlanmaguncha 24 soatlik reply window ochilmasin.
- Bir event bir martadan ortiq reply yubormasin.
- Har bir tenantga tegishli query `workspace_id` bilan cheklansin. Provider account lookup ham tenantni noaniq tanlamasligi kerak.

## Arxitektura chegaralari

- Frontend: `web/`, Next.js App Router, TypeScript va custom CSS.
- Backend: `api/`, Go `net/http`, pgx, PostgreSQL durable queue, optional Redis wake-up signal.
- Provider-specific kod faqat `api/internal/provider/` ichida qoladi.
- HTTP handler database SQL yozmasin; persistence `api/internal/store/` orqali bo‘lsin.
- Security primitive’lari `api/internal/security/`, rule matching `api/internal/rules/` ichida qoladi.
- Yangi schema o‘zgarishi yangi migration orqali qilinsin; production’da qo‘llangan migrationni orqadan tahrirlash mumkin emas.

## Kod yozish standartlari

### Go

- Har patchdan keyin `gofmt`.
- Xatolarni context bilan qaytaring, secret yoki raw sensitive payloadni log qilmang.
- Handler inputiga size limit, strict JSON decode, server-side validation va RBAC qo‘llang.
- Tenant isolationni repository signature’larida majburiy qiling.
- Provider errorlarini foydalanuvchiga token/secret bilan chiqarib yubormang.
- Yangi policy, matcher, signature, tenant va authorization xulqi uchun table-driven unit/integration test yozing.

### TypeScript/React

- `strict` TypeScriptni saqlang; `any`dan faqat asoslangan holatda foydalaning.
- Async sahifalarda loading, error, empty va retry holatlari bo‘lsin.
- React effect ichida synchronous state derivation yozmang; render-time derivation yoki async callback ishlating.
- Uzbek-first matnni saqlang. Mavjud UZ/RU/EN tarjimalarini yangi ekran va holatlarda ham to‘liq davom ettiring.
- 360px, 768px va 1440px breakpointlarni tekshiring; keyboard focus va form label’larini saqlang.
- Test fixture’lari product UI/API’ga chiqmasin.

## Test va quality gate tartibi

Feature tugallangan deb aytishdan oldin:

```powershell
# Repository root
npm run lint:web
npm run test:web
npm run build:web

# api/
go test ./...
go vet ./...
go build ./cmd/server ./cmd/migrate

# Disposable PostgreSQL test DB mavjud bo‘lsa
go test -tags=integration -v ./internal/store
```

Database/auth/tenant/webhook o‘zgarishlarida PostgreSQL integration va kamida bitta cross-tenant negative test majburiy. OAuth/Meta o‘zgarishida controlled provider test va real Meta eligible-account testi alohida qayd etilsin; controlled test live Meta deb atalmasin. Google OIDC o‘zgarishida controlled signed-token/state/nonce/PostgreSQL testi va production’da real Google consent/session acceptance alohida qayd etilsin; controlled issuer live Google deb atalmasin.

Quality gate fail bo‘lsa feature “done” emas. Environment xatosi bo‘lsa command, exit code va aniq xabarni hujjatga yozing.

## Xavfsizlik

- `.env`, access token, App Secret, DB password, session token va webhook secretni commit/log/UI qilmang.
- OAuth token browserga yuborilmasin; faqat serverda AES-256-GCM ciphertext saqlansin.
- Google OAuth’da faqat Google imzosi tekshirilgan ID token qabul qilinsin; issuer, audience, expiry, nonce va `email_verified` talab qilinadi. State browser cookie va database one-time state bilan tekshirilsin.
- `GOOGLE_CLIENT_SECRET` va Meta secretlari faqat server environment’da; Google OAuth access token serverda saqlanmasin yoki log/UI/frontend bundle’ga chiqarilmasin.
- Google login yangi userga faqat `register` intenti va terms roziligida workspace ochadi; verified email bo‘lmasa login/link qilish taqiqlanadi.
- Production’da unique `TOKEN_ENCRYPTION_KEY`, 32+ belgilik `SESSION_SECRET`, HTTPS va `COOKIE_SECURE=true` kerak.
- Cookie mutationlarda CSRF, auth/reset endpointlarda rate limit saqlansin.
- Webhook Meta rejimida HMAC signature tekshirilmasdan event qabul qilinmasin.
- Permanent yoki noaniq provider xatosini blind retry qilmang. `sending` delivery markerini chetlab o‘tib qayta yubormang; noaniq holat operator tekshiruviga qolsin.
- Destructive action oldidan aniq target va confirmation tekshiring.

## Hujjatlash

- Feature holatini faqat real kod va bajarilgan testga asoslanib yozing.
- Yangi endpoint/schema/env qo‘shilsa `README.md`, `docs/ARCHITECTURE.md`, `.env.example` va tegishli statusni yangilang.
- Meta permission, endpoint, API version va policy o‘zgaruvchan; implementatsiya oldidan rasmiy Meta hujjatini tekshiring va verification sanasini yozing.
