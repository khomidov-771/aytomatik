# Meta / Instagram setup checklist

Bu konfiguratsiya hujjati; Meta approval yoki live delivery dalili emas.

## Meta bergan konfiguratsiya

- Product: Instagram API (Unified Login)
- Label: Instagram Login Compatible
- Configuration ID: `2331645327602552`

Configuration ID public OAuth metadata. App Secret, webhook secret va access token repository/frontend/logga yozilmaydi.

## Dashboard

- [ ] To‘g‘ri Meta App configuration ID’ga egalik qiladi.
- [ ] Facebook Login for Business / Instagram API Unified Login yoqilgan.
- [ ] Exact redirect: `https://<domain>/api/v1/instagram/callback`.
- [ ] Exact webhook: `https://<domain>/api/v1/webhooks/instagram`.
- [ ] Verify token server environment bilan bir xil.
- [x] App darajasida `comments`, `messages`, `messaging_postbacks` fieldlari Graph API `GET /{app-id}/subscriptions`da qayta tasdiqlandi (2026-11-12). Account darajasidagi obuna alohida tekshiriladi.
- [ ] Exactly one test Instagram Professional account asset ulashga berilgan.
- [ ] Comment management va messaging permissions current Meta dashboardda tasdiqlangan.
- [ ] Test users/business va App Review/Advanced Access tayyor.
- [ ] Privacy, terms va data-deletion URL public.

## Environment

```dotenv
INSTAGRAM_PROVIDER=meta
META_APP_ID=<meta-app-id>
META_APP_SECRET=<server-only-secret>
META_API_VERSION=<supported-version>
META_LOGIN_MODE=unified
META_LOGIN_CONFIG_ID=2331645327602552
META_REDIRECT_URI=https://<domain>/api/v1/instagram/callback
META_WEBHOOK_VERIFY_TOKEN=<random-server-only-token>
META_WEBHOOK_APP_SECRET=<signature-secret>
```

Production incomplete Meta config bilan start qilmaydi.

## Follow verification

- [ ] Login path uchun `is_user_follow_business` official support qayta tekshirildi.
- [ ] Required messaging permission/context real account bilan tasdiqlandi.
- [ ] `true` → FOLLOWER real test.
- [ ] aniq `false` → NOT_FOLLOWER real test.
- [ ] missing field/permission/API/network → UNKNOWN real test.
- [ ] Unified/Facebook Login support bo‘lmasa builder capability warning ko‘rsatadi va fallback ishlaydi.

Commentning o‘zi follow/profile permissionni kafolatlamaydi. Scraping/private API taqiqlanadi.

## Comment-to-DM live acceptance

- [ ] OAuth single-use state bilan tugaydi.
- [ ] Token ciphertext saqlanadi, UI/logda yo‘q.
- [ ] Account webhook subscription confirmed.
- [ ] Signed real comment webhook qabul qilinadi.
- [ ] Duplicate webhook duplicate action yaratmaydi.
- [ ] Private reply bir marta va time window ichida yuboriladi.
- [ ] Meta reject qilsa sent deb yozilmaydi.
- [ ] Public success reply faqat private successdan keyin.
- [ ] Private failureda “DM yuborildi” public reply yo‘q.
- [ ] Private success/public failure alohida yoziladi va private qayta yuborilmaydi.
- [ ] Not-follower branch DM yubormaydi.
- [ ] UNKNOWN fallback ikkala policy bilan tekshiriladi.
- [ ] Rate limit, revoked token va permission error operatorga aniq chiqadi.

## Joriy holat

2026-11-12 so‘nggi audit: app-level Instagram webhook subscription `active=true`, callback production URL bilan mos va `comments,messages,messaging_postbacks` fieldlari Meta Graph API `GET` javobida aniq ko‘rindi. Bunga qadar shu `GET` `fields`ni qaytarmagan; rasmiy `POST /{app-id}/subscriptions` `success=true` bilan fieldlarni yozdi. Account hozir `disconnected`, qoida/event/actionlar `0`; account-level subscription va real delivery hali tekshirilmagan. Quyidagi eski audit matni o‘sha vaqtdagi tarixiy holatdir.

2026-11-12 tekshiruvida production `META_*` env qiymatlari konteyner bilan mos, Unified Login va Configuration ID kutilgan qiymatlarda, redirect URI production callback bilan aynan mos. Serverdagi joriy App ID/Secret juftligi Meta credential probe’dan o‘tdi; token javobi chiqarilmadi yoki saqlanmadi. OAuth statusini `enabled=false` qilgan backend validator xatosi Google callback yo‘lini Instagram callback uchun talab qilgani sababli bo‘lgan va tuzatildi. API deploydan so‘ng public status `api_ready=true`, `enabled=true`, `login_mode=unified` qaytardi. Haqiqiy Instagram OAuth consent, asset discovery, webhook va message delivery hali **NOT TESTED LIVE**.

