# Smart keywords va javoblar — amalga oshirish rejasi

2026-11-14. Mavjud Go net/http, pgx/PostgreSQL worker va Next.js arxitekturasi saqlanadi. `ids-automate` skill qo‘llanadi.

1. `api/internal/domain`, `rules`: NFC + case folding, o‘zbek transliteratsiyasi, so‘z chegaralari, explicit sinonim/imlo variantlari, cheklangan Damerau–Levenshtein; izohlanadigan guruh matchlari.
2. `009_smart_keywords.sql`, `store`: tenant-scoped guruh/variant/template jadvallari, composite FK va indekslar. Eski qoidalar o‘zgartirilmaydi. CRUD bitta transactionda; execution snapshot va template ID tarixi retryda saqlanadi.
3. `worker`: barcha guruhlarni aniqlash, default eng yuqori priority aniq guruh; optional combine bitta DM. Random DM marker oldidan, public tanlov faqat private successdan so‘ng. Mavjud follow fallback semantikasi saqlanadi.
4. `httpapi/automations.go`, `web/lib/types.ts`, `keyword-groups-editor.tsx`, `automation-form.tsx`, `setup-wizard.tsx`: nested guruh CRUD, preview va execution history.
5. Settings/dashboard va umumiy CSS: unreadable disabled input/switch, ortiqcha banner va diagnostika; UZ/RU/EN, light/dark, 360/768/1440.
6. Unit, real disposable PostgreSQL tenant/concurrency/worker integration, frontend lint/build va browser tekshiruvi.
7. Production database backup va image rollback; alohida release katalogi; faqat api/web, additive migration. Server smoke va read-only data-preservation tekshiruvi; keyin Git push.

Chegaralar: yangi matcher tashqi AI ishlatmaydi. Template uzunligi va normalization workload chegaralangan. Live Meta testi uchun ruxsatli commenter/post kerak; controlled provider testi real Meta deb ko‘rsatilmaydi. Bajarilgan dalillar yakuniy hisobotda yoziladi.
