# AI handoff

Yangilangan: 2026-11-10.

## Birinchi o‘qiladigan fayllar

1. `AGENTS.md`
2. `README.md`
3. `docs/TECHNICAL_SPEC.md`
4. `docs/ARCHITECTURE.md`
5. `docs/PROJECT_STATUS.md`
6. `docs/NEXT_STEPS.md`
7. `.codex/skills/ids-automate/SKILL.md`

## Mahsulot konteksti

IDS Automate endi umumiy SaaS suite emas. Core product:

```text
REAL COMMENT → KEYWORD MATCH → OPTIONAL FOLLOW CHECK → PRIVATE REPLY → PUBLIC COMMENT REPLY
```

Subscription/payment scope olib tashlangan. Productda demo mode, demo credential, mock lab, fake account va fake analytics bo‘lmasligi kerak.

## Hozirgacha bajarilgan ish

- Migration `005_core_comment_to_dm.sql` qo‘shildi.
- Automation rule’ga private/public template’lar, follow toggle va UNKNOWN fallback qo‘shildi.
- `FOLLOWER`, `NOT_FOLLOWER`, `UNKNOWN` tri-state implementatsiya qilindi.
- Direct Instagram Login uchun `is_user_follow_business` controlled API implementation qo‘shildi.
- Unified/Facebook Login follow check ataylab `UNKNOWN`; live support da’vo qilinmaydi.
- Meta public comment reply adapteri qo‘shildi.
- Worker private reply muvaffaqiyatini kutib, keyin public success reply yuboradigan state machine’ga o‘tkazildi.
- Not-follower va UNKNOWN fallback branchlari ajratildi.
- `automation_execution_actions` ledger follow/private/public natijalarni alohida saqlaydi.
- Private reply duplicate/ambiguous retry fail-closed. Public reply faqat aniq retryable failureda max 3 urinish.
- Execution history API va UI qo‘shildi.
- Billing/campaign/mock-lab sahifalari va API route’lari olib tashlandi.
- Demo login autofill, demo badge, mock event form va demo credentials olib tashlandi.
- Legacy mock account/rulelar migration bilan data yo‘qotmasdan deaktivatsiya qilinadi.
- Seed command olib tashlandi; API Dockerfile faqat server quradi.
- Landing/dashboard/analytics faqat core product va database natijasini ko‘rsatadi.
- Public, auth va workspace UI professional light-first uslubga yangilandi; deep-navy sidebar saqlandi.
- Workspace bo‘ylab shrift, spacing, card, form, Inbox, builder va responsive o‘lchamlar o‘qiladigan professional scale’ga ko‘tarildi.
- Dashboardga real `connected accounts` va `active automations` holatidan hisoblanadigan 3 bosqichli onboarding hero qo‘shildi; bo‘sh chart fake nuqtalar bilan to‘ldirilmaydi.
- Til, workspace, analytics oralig‘i, account/fallback va team role tanlovlari `web/components/select-menu.tsx` orqali bir xil light/dark custom dropdown ishlatadi; native browser menu’ni qaytarmang.
- `web/components/preferences-provider.tsx` UZ/RU/EN tanlovi, light/dark tema va browser persistence’ni boshqaradi.
- Landing, legal, auth va barcha asosiy app modullari uch tilli matnlarga ulandi.

## Arxitektura qarorlari

1. PostgreSQL source of truth va durable queue; Redis wake-up signal xolos.
2. Har external side effect oldidan committed action marker.
3. Private reply noaniq outcome’da qayta yuborilmaydi.
4. Public “DM yuborildi” matni private action `succeeded` bo‘lmaguncha yuborilmaydi.
5. Private success/public failure alohida yoziladi va faqat public action safe retry qilinadi.
6. Follow missing field/error/rate limit/network = `UNKNOWN`, hech qachon `NOT_FOLLOWER` emas.
7. Comment mavjudligi profile/follow permission mavjudligini anglatmaydi.
8. Provider-specific kod `api/internal/provider` ichida.
9. Tenant isolation store signature va SQL’da `workspace_id` bilan majburiy.
10. Legacy billing schema production data xavfsizligi uchun hozircha saqlanadi, lekin application ishlatmaydi.

## Qayta yozmang

- Auth/session/CSRF/RBAC bazasini.
- OAuth state bir martalik oqimini.
- AES-256-GCM token encryptionni.
- PostgreSQL durable queue/lease recoveryni.
- Action-ledger idempotency modelini.
- Tri-state follow semanticsni.
- Existing migrationsni; yangi schema uchun yangi migration yozing.

## Muhim fayllar

- `api/internal/worker/worker.go` — core state machine
- `api/internal/provider/provider.go` — Meta login/follow/private/public/message API
- `api/internal/store/store.go` — rules, queue, action ledger, history, Inbox
- `api/internal/migrations/005_core_comment_to_dm.sql` — additive data-preserving schema
- `api/internal/httpapi/instagram.go` — OAuth/webhook
- `web/components/automation-form.tsx` — builder va execution history
- `web/components/preferences-provider.tsx` — locale/theme state va umumiy controls
- `web/app/globals.css` — light/dark professional design token va override’lar
- `web/app/app/page.tsx` — real statusga asoslangan dashboard onboarding va empty analytics holati
- `web/app/app/accounts/page.tsx` — login mode/capability warning

## 2026-11-10 soddalashtirilgan Instagram UX

- Accounts sahifasi real OAuth’ni “Instagram bilan kirish” deb aniq ko‘rsatadi, Professional account va official Instagram/Meta oynasi ekanini tushuntiradi; parol IDS Automate’ga kelmaydi.
- Automation builderdagi raw `Media ID` input olib tashlandi.
- `GET /api/v1/instagram/accounts/{id}/media` tenant-scoped encrypted token orqali official Meta media edge’dan so‘nggi 50 post/Reels metadata oladi.
- Builder thumbnail, caption, turi va sana bilan vizual multi-select beradi; “barcha postlar” kelajakdagi postlarni ham qamrab oladi.
- Provider host/path/bearer/fields controlled testdan o‘tgan. Production’da valid Meta credential va real connected account yo‘qligi sabab live media list hali tekshirilmagan.

## Tekshirilgan testlar

2026-11-10:

- `go test ./...` — PASS
- `go vet ./...` — PASS
- `go build ./cmd/server ./cmd/migrate` — PASS
- PostgreSQL integration `TestTenantTokensInboxAndQueue` — PASS
- `npm run lint:web` — PASS
- `npm run test:web` — PASS, 2/2
- `npm run build:web` — PASS, 21 route

PostgreSQL integration Windowsda embedded PostgreSQL 18.6.1 processiga qarshi o‘tdi. Docker CLI mavjud emas edi.

## Live tekshirilmagan

- Meta OAuth real browser consent va App Review.
- Real access token exchange/expiry/revoke.
- Real signed webhook payload.
- Real `is_user_follow_business` follower/non-follower/unknown.
- Real private reply delivery va one-reply/time-window response.
- Real public comment reply va private-success/public-failure recovery.
- Real inbound DM/manual send.

Controlled tests live dalil emas.

## 2026-11-10 production auditi

Production server va public HTTPS ishlaydi, ammo active Meta credential Meta Graph tomonidan `OAuthException` code `190` bilan rad etildi. Database’da faqat tokeni yo‘q `disconnected` eski mock account bor; active rules, webhook events va executions yo‘q. `Config.MetaConfigurationReady()` qo‘shilib, placeholder credential endi UI/health’da configured deb ko‘rsatilmaydi. Keyingi agent valid App Secretni faqat server environment orqali qabul qilib, keyin real OAuth va live acceptance bajarishi kerak.

## Qayerdan davom etish

Birinchi topshiriq: `docs/NEXT_STEPS.md`dagi P0 Live Meta acceptance testini eligible test account bilan bajaring. Kodni taxminan o‘zgartirmang; avval real response va database action rowsni qayd eting. Incompatibility topilsa eng kichik provider/worker patch va regression test yozing.

## Guardrail

- Scraping/private API yo‘q.
- Mock product mode’ni qaytarmang.
- Billing scope’ni qaytarmang.
- Secret/tokenni commit/log/UI qilmang.
- Real test bo‘lmasa “Meta integration ishlaydi” deb yozmang.
- Private failureda public success reply yubormang.
- Unknown follow statusni non-follower deb ko‘rsatmang.
