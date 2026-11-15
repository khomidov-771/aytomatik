# REPLEO · guruhli kalit so‘zlar va javob shablonlari

## A. Natija

Qoida muharriri, onboarding, Go API, PostgreSQL va webhook worker bitta guruhli qoida formatidan foydalanadi. Eski qoidalarni ko‘chirish yoki qayta yaratish shart emas. Guruhlar ixtiyoriy. Dashboard so‘nggi yetti kunlik natijalarni ko‘rsatadi. Boshlang‘ich yo‘riqnoma faqat ulanish yoki faol qoida yetishmaganda chiqadi. Sozlamalarda profil, o‘qiladigan email, til va bildirishnomalar bir joyda. Diagnostika yig‘ilgan holda ochiladi. Xavfsizlik va maxfiylik alohida bo‘limda.

## B. Fayllar va sabablar

Yo‘llar repository ildiziga nisbatan berilgan.

| Fayl | O‘zgarish va sababi |
|---|---|
| `api/go.mod` | NFC va Unicode case folding uchun bevosita ishlatilayotgan `x/text` bog‘liqligini ko‘rsatadi. |
| `api/internal/domain/keywords.go` | Guruh, variant, shablon va aniqlangan moslikning umumiy JSON turlari. |
| `api/internal/domain/types.go` | Qoidaga guruhlar, execution’ga mosliklar, action’ga tanlangan shablon ID’lari qo‘shildi. |
| `api/internal/rules/matcher.go` | Normalizatsiya, transliteratsiya va eski qoidalar uchun chegarali moslik. |
| `api/internal/rules/smart.go` | Aniq va taxminiy moslik, ustuvorlik, tasodifiy faol shablon va xavfsiz o‘zgaruvchi almashtirish. |
| `api/internal/rules/validation.go` | Serverda ID, guruh, so‘z, o‘zgaruvchi va javob hajmlari tekshiriladi. |
| `api/internal/rules/smart_test.go` | Ikki yozuv, sinonim, imlo, noto‘g‘ri mosliklar, guruh tanlovi va shablon testlari. |
| `api/internal/migrations/009_smart_keywords.sql` | Guruhlar uchun tenantga bog‘langan jadvallar va yetkazish dalillariga qo‘shimcha maydonlar. |
| `api/internal/migrations/migrate.go` | Migration ledger’ini joriy PostgreSQL search path bo‘yicha topadi. |
| `api/internal/store/keyword_groups.go` | Bitta tranzaksiyada guruh va shablonlarni saqlaydi, worker uchun qoida nusxasini qayd etadi. |
| `api/internal/store/store.go` | Rule CRUD, tenant cheklovi, bir vaqtdagi tahrirlarni aniqlash, action va execution tarixini o‘qish. |
| `api/internal/httpapi/automations.go` | Create, patch va preview guruhlarni qabul qiladi. Noto‘g‘ri qiymat 422, parallel tahrir to‘qnashuvi 409 beradi. |
| `api/internal/worker/worker.go` | Mosliklar va tanlangan javoblar qayta ishlash, Inbox va xavfsiz retry uchun saqlanadi. |
| `api/internal/config/config_test.go` | Production konfiguratsiyasi sinoviga haqiqiy formatdagi HTTPS test callback’i kiritildi. |
| `api/internal/testdb/postgres.go` | Integratsiya testlariga umumiy vaqtinchalik PostgreSQL sxemasi beradi. |
| `api/internal/store/store_integration_test.go` | Mavjud regressiya sinovlari umumiy test bazasidan foydalanadi. |
| `api/internal/store/smart_integration_test.go` | Tenantlar ajratilishi, ikki worker, duplicate, DM rad etilishi va shablon o‘chirilgandan keyingi public retry sinovlari. |
| `api/internal/httpapi/google_oauth_integration_test.go` | Mavjud OIDC regressiya testi Docker’dagi ajratilgan PostgreSQL bilan ishlaydi. |
| `api/internal/httpapi/smart_integration_test.go` | Auth, CSRF, boshqa workspace, preview, webhook imzosi, dublikat va yozilgan execution’ni HTTP kirish nuqtasidan tekshiradi. |
| `web/lib/types.ts` | Frontend API shartnomasi guruh va tarix turlarini qamrab oladi. |
| `web/lib/keyword-groups.ts` | Draft yaratish, nusxalashda yangi ID, variantlar va sahifalar orasidagi validatsiya. |
| `web/components/keyword-groups-editor.tsx` | UZ/RU/EN guruh muharriri, sinonim, typo, ustuvorlik, shablonlar, o‘zgaruvchilar va preview. |
| `web/components/automation-form.tsx` | To‘rt qadamli muharrir, guruhli saqlash, izoh sinovi va tarix. Keyingi qadamni bosish yakuniy saqlashga aylanib ketishi tuzatildi. |
| `web/components/setup-wizard.tsx` | Dastlabki sozlash ham o‘sha muharrirdan foydalanadi, guruhlar ko‘rib chiqish bosqichida ko‘rinadi. |
| `web/app/app/automations/page.tsx` | Ro‘yxatda guruh nomlari ko‘rinadi, har bir kartadagi takroriy oqim olib tashlandi. |
| `web/app/app/page.tsx` | Katta banner va takroriy tugmalar olib tashlandi. DM ulushi serverdagi maxrajga mos nomlandi. |
| `web/app/app/analytics/page.tsx` | Ishlamaydigan CSV tugmasi olib tashlandi. |
| `web/app/app/settings/page.tsx` | Profil, rolga mos diagnostika, maxfiylik, saqlash holati va klaviatura bilan boshqariladigan switch. |
| `web/components/app-shell.tsx` | Yon paneldagi takroriy qoida havolasi va bildirishnoma o‘rniga Settings ochgan qo‘ng‘iroq tugmasi olib tashlandi. |
| `web/app/workspace-controls.css` | Light/dark maydonlar, kartalar, ixcham telefon ko‘rinishi va birinchi kadrdan o‘qiladigan animatsiya. |
| `web/app/layout.tsx` | Yangilangan workspace uslublarini barcha kerakli sahifalarga ulaydi. |
| `web/e2e/critical-flow.spec.ts` | Eski email/parol ssenariysi o‘rniga Instagram kirish oynasi, desktop/mobil, sozlamalar va to‘rt qadamli muharrir sinovlari. |
| `README.md` | Guruhli qoidani yaratish va qo‘llash tartibi. |
| `docs/ARCHITECTURE.md` | API, schema va worker bo‘yicha yangi oqim. |
| `docs/SMART_KEYWORDS_IMPLEMENTATION.md` | Amaldagi arxitektura auditi va kodlashdan oldingi migratsiya rejasi. |
| `docs/PROJECT_STATUS.md` | Tekshirilgan release va ochiq jonli sinov holati. |
| `docs/NEXT_STEPS.md` | Keyingi real Instagram qabul sinovi. |
| `docs/AI_HANDOFF.md` | Keyingi agent uchun release, compatibility va test yo‘li. |
| `docs/TEST_REPORT.md` | Regressiya natijalari va dalillar manzili. |
| `docs/SMART_KEYWORDS_REPORT.md` | Ushbu fayl. Qabul mezonlari, cheklovlar va production dalillari. |

## C. PostgreSQL

`automation_keyword_groups` guruh nomi, priority, faollik, fuzzy threshold va shablon o‘zgaruvchilarini saqlaydi. `automation_keyword_variants` bir guruhning asosiy so‘zlari, sinonimlari va kiritilgan imlo variantlarini saqlaydi. `automation_reply_templates` guruhga tegishli `private` va `public` javoblarni alohida kanal bilan saqlaydi. Uch jadvalning UUID primary key’i, vaqt belgilari, tenant foreign key’lari va guruh/kanal bo‘yicha indekslari bor.

`automation_rules` ga `combine_group_replies` va tenant bo‘yicha composite unique key qo‘shildi. `automation_executions` ga `rule_snapshot` va `keyword_matches`, `automation_execution_actions` ga `template_ids` qo‘shildi. Tarixdagi identifikator shablon o‘chirilganidan keyin ham saqlanadi. Eski execution’larda ilgari yozilmagan ma’lumotlar bo‘sh qoladi. Yangi environment variable talab qilinmaydi.

## D. Kalit so‘zdan qarorgacha

1. Izohning asl matni saqlanadi. Moslashtirish uchun NFC, Unicode case folding, apostrof birlashtirish, tinish va bo‘sh joylarni tozalash hamda kirilldan kanonik lotinga o‘tkazish qo‘llanadi. Masalan, `НАРХ`, `НаРх` va aralash yozilgan `NаРx` bir xil so‘zga tushadi. Preview o‘zbekcha kirill ko‘rinishini ham qaytaradi.
2. `keyword_list` butun so‘z yoki iboraga, `exact` butun izohga, `contains` esa foydalanuvchi tanlagan qisman moslikka ishlaydi. `narxi` so‘zini `narx` bilan butun-so‘z rejimida birlashtirish uchun uni sinonim sifatida kiriting.
3. Qo‘lda kiritilgan sinonim va imlo variantlari aniq moslik sifatida tan olinadi. Qolgan imlo xatolariga guruh ruxsat berganda chegarali optimal string alignment masofasi ishlatiladi. Yonma-yon harf almashishi bitta tahrir. Threshold 1 yoki 2. To‘rt belgidan qisqa yoki birinchi harfi farqli so‘zlar va oddiy prefiks kengayishi taxmin qilinmaydi. Tahrirlar so‘z uzunligining choragidan oshmaydi.
4. Har bir faol guruhdan bitta eng yaxshi moslik olinadi. Aniq moslik, kichik priority raqami, kamroq xato va uzunroq variant tartibida tanlanadi. `NARXI qancha va dostavka bormi?` izohida narx guruhi bir marta, yetkazish guruhi bir marta qayd etiladi.
5. Bir qoida 100 guruh, jami 2 000 variant va jami 1 000 shablongacha qabul qiladi. Har guruhda 100 variant va har kanal uchun 50 shablon chegarasi bor. Yuboriladigan render qilingan xabar 1 000 belgigacha.

## E. Javob tanlovi

Tanlov Go `crypto/rand` orqali faol va to‘ldirilgan variantlar orasida bajariladi. Bitta variant bo‘lsa o‘sha yuboriladi. Ketma-ket ikki izoh tasodifan bir xil variant olishi mumkin. `{{price}}` kabi qiymatlar guruh egasi bergan lug‘atdan olinadi. Noma’lum o‘zgaruvchi saqlashda rad etiladi. Javobi bo‘sh chiqqan shablon yuborilmaydi.

Odatda eng ustuvor mos guruhdan bitta Direct tanlanadi. Birlashtirish yoqilsa mos guruhlarning javoblari bitta Direct’ga yig‘iladi. Muvaffaqiyatli Direct ortidan asosiy guruhdan ko‘pi bilan bitta public javob tanlanadi. Faol public shablon bo‘lmasa operatsiya `skipped` bo‘ladi. ID va ishlatilgan yakuniy matn har kanal uchun alohida saqlanadi.

## F. Webhook, Meta va retry

Imzoni tekshirish, vaqt oynasi, self-comment cheklovi, follow holati va hisobga mos login yo‘li mavjud provider orqali ishlaydi. Izohning provider ID’si, PostgreSQL lease va execution/action unique cheklovlari takror yuborishdan himoya qiladi. Private reply rad etilganda public muvaffaqiyat javobi yaratilmaydi. Natija noma’lum bo‘lsa, xavfli takroriy DM yuborilmaydi. Tasdiqlangan DM’dan keyingi aniq qayta uriniladigan public xatoda faqat public amal dastlabki matn va ID bilan qayta bajariladi. Follow tekshiruvi alohida talab qilinadigan holatda non-follower yoki UNKNOWN uchun oldindan sozlangan neytral javob saqlanadi.

## G. Sinov natijalari

| Sinov | Natija |
|---|---|
| Docker PostgreSQL va Go integratsiya, deploy oldi | 55 asosiy test, 125 test va subtest o‘tdi, 0 failed |
| Xuddi shu to‘plam, deploydan keyin | 55 asosiy test, 125 test va subtest o‘tdi, 0 failed |
| Go paketlari | 8 paket o‘tdi, test fayli bo‘lmagan 5 paket `skip` |
| Frontend | Lint va production build o‘tdi, Vitest 2/2 |
| Edge mahalliy va server production build | Har birida 6/6 ssenariy, 360, 390, 768, 1440 piksel |
| Production sahifalar va resurslar | 16 HTML yo‘li, 27 CSS/JS resursi, yangi CSS selektorlari va 6 API tekshiruvi o‘tdi |

PostgreSQL sinovlari ajratilgan bazada haqiqiy SQL, HTTP handler va worker bilan ishlandi. Provider muvaffaqiyat/rad/javoblarni nazorat qilingan test adapteri qaytardi. Real Meta hisobiga sinov xabari yuborilmadi.

## H. Deployment

- Versiya `cefb6d6`, 2026-11-15 10:29:15 Toshkent vaqti.
- API va web yangi image’dan ishga tushdi. PostgreSQL va Redis konteynerlari saqlandi. Mavjud runtime environment qiymatlari taqqoslandi.
- PostgreSQL dump `/opt/repleo-backups/smart-20261115T052835Z/database.dump` yaratildi va archive ro‘yxati tekshirildi. Oldingi web va API image’lari rollback uchun teglandi.
- `009_smart_keywords.sql` production ledger’da qo‘llangan. Oldingi 3 user, 3 workspace, 2 account, 3 rule, 25 event, 25 execution, 36 action va 20 message ID’si saqlangan.
- Health API `ok`, Meta konfiguratsiyasi tayyor deb qaytdi. Instagram login status `enabled` qaytardi. Bu ko‘rsatkich ruxsat va haqiqiy kirishni mustaqil isbotlamaydi.
- Avvalgi execution’larda provider identifikatori bilan 11 private va 12 public muvaffaqiyat bor.

## I. Qolgan ishlar va cheklovlar

- Yangi guruhli qoida uchun haqiqiy ikkinchi Instagram hisobidan comment qoldirib DM va public javob qabulini tekshirish kerak. Owner real post va commentni belgilaydi. Avtomatik sinov tashqi foydalanuvchiga xabar yubormagan.
- Follow holatini tekshirish Meta ruxsatlari, login usuli va mavjud messaging kontekstiga bog‘liq. Tasdiqlanmagan holat UNKNOWN bo‘lib qoladi.
- O‘zbekcha va ruscha transliteratsiya ayrim bir xil talaffuzli harflarda yo‘qotishli. Zarur qo‘shimcha yozilishlarni sinonim sifatida kiriting.
- 100 guruh, 2 000 variant, 1 000 shablon va xabarga 1 000 belgi chegaralari server resurslari va yuborish xavfsizligi uchun tanlangan.

## J. Yettita funksiyaning holati

1. Lotin va kirill — avtomatik testdan o‘tgan, guruhli real Meta comment sinovi kutilmoqda.
2. Katta-kichik harflar — avtomatik testdan o‘tgan, real Meta comment sinovi kutilmoqda.
3. Sinonim va nazoratli typo — avtomatik testdan o‘tgan, real Meta comment sinovi kutilmoqda.
4. Bir nechta guruh — PostgreSQL, HTTP va brauzerda testdan o‘tgan.
5. Bir commentda bir nechta guruh — PostgreSQL worker testidan o‘tgan, real Meta comment sinovi kutilmoqda.
6. Tasodifiy DM variantlari — test adapteri va PostgreSQL tarixida tekshirilgan, real Meta comment sinovi kutilmoqda.
7. Tasodifiy public javob — test adapteri, saqlangan ID va qayta urinishda tekshirilgan, real Meta comment sinovi kutilmoqda.
