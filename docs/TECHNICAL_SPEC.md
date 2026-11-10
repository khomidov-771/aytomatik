# IDS Automate — texnik topshiriq

Versiya: 2.0, 2026-11-10.

## 1. Maqsad

Instagram Professional akkauntidagi real commentni keyword asosida aniqlash, ixtiyoriy follow tekshiruvini bajarish, rasmiy Meta private-reply mexanizmi bilan DM yuborish va faqat tasdiqlangan private successdan keyin public comment javobini yuborish.

Scope’dan chiqarilgan: subscription/payment, pricing plan, demo mode, demo credential, fake account, fake analytics, campaign builder va scraping.

## 2. Foydalanuvchi rollari

- `customer`: o‘z workspace ma’lumotlarini ko‘rish.
- `operator`: Inboxni ko‘rish va policy oynasi ichida manual reply yuborish.
- `manager`: Instagram account, automation va analyticsni boshqarish.
- `owner`: manager huquqlari + team, sessions va privacy request.

## 3. Automation konfiguratsiyasi

Har bir rule:

- Instagram account;
- barcha eligible postlar yoki tanlangan media ID’lar;
- keywordlar va exclusions;
- `exact`, `contains`, `keyword_list` matching;
- private DM template;
- private successdan keyingi public template;
- not-follower public template;
- UNKNOWN neutral public template;
- follow verification toggle;
- UNKNOWN fallback: `send_private_reply` yoki `skip_dm_neutral_reply`;
- active/disabled;
- priority;
- execution history va action error details.

## 4. Core workflow

### 4.1 Webhook

1. `X-Hub-Signature-256` Meta App Secret bilan tekshiriladi.
2. Body limit va payload format tekshiriladi.
3. Provider event ID unique key bilan saqlanadi.
4. Duplicate webhook yangi action yaratmaydi.

### 4.2 Match

1. Connected real provider account topiladi.
2. Active rules priority bo‘yicha olinadi.
3. Media scope, exclusions va keyword match bajariladi.
4. Bir event uchun bir rule execution ishlaydi.

### 4.3 Follow

- Disabled: status `NOT_CHECKED`, private reply branch.
- Enabled va API `true`: `FOLLOWER`.
- Enabled va API aniq `false`: `NOT_FOLLOWER`.
- Missing field, permission/context yo‘q, API/network error yoki unsupported login path: `UNKNOWN`.
- `UNKNOWN` hech qachon `NOT_FOLLOWER`ga aylantirilmaydi.
- Faqat rasmiy Meta API; scraping/private endpoint taqiqlanadi.

`is_user_follow_business` faqat configured login path, API version, messaging permission va participant context qo‘llasa ishlatiladi. Commentning o‘zi bu capabilityni kafolatlamaydi.

### 4.4 Private reply

- Meta official comment private-reply endpoint ishlatiladi.
- Bir commentga bir private reply cheklovi va amaldagi vaqt oynasi hurmat qilinadi.
- External call oldidan `sending` action marker commit qilinadi.
- Meta reject qilsa `sent` yozilmaydi.
- Timeout/network ambiguity’da action `unknown`; blind retry yo‘q.
- Provider message ID faqat success response’da saqlanadi.

### 4.5 Public reply

- `FOLLOWER`, follow-disabled yoki UNKNOWN-send branchida public success reply faqat private action `succeeded` bo‘lsa.
- `NOT_FOLLOWER`: DM yo‘q, not-follower template.
- `UNKNOWN + skip`: DM yo‘q, neutral template.
- Private failure/unknown: “DM yuborildi” public reply yo‘q.
- Private success/public failure ikki alohida result.
- Aniq retryable public failureda faqat public action max 3 marta retry.

## 5. Data modeli

`automation_rules` yangi fieldlari:

- `private_reply_text`
- `public_success_reply_text`
- `public_not_follower_reply_text`
- `public_unknown_reply_text`
- `follow_verification_enabled`
- `unknown_fallback_policy`

`automation_executions`:

- workspace/rule/event;
- status;
- `follow_status`;
- error code/message;
- created/completed timestamps.

`automation_execution_actions`:

- `follow_check`, `private_reply`, `public_reply`;
- status: `sending`, `succeeded`, `failed`, `failed_retryable`, `unknown`, `skipped`;
- immutable selected message text;
- outcome/provider result/error;
- attempt count va timestamps;
- unique `(execution_id, action_type)`.

## 6. OAuth va token xavfsizligi

- OAuth state random, hashed, 10 daqiqalik, bir martalik va workspace/userga bound.
- Access token browserga yuborilmaydi.
- Token database’da AES-256-GCM ciphertext.
- Production key base64 32-byte environment secret.
- Account boshqa active tenant tomonidan claim qilinsa ulash rad etiladi.
- Unified login callback faqat exactly one assigned Professional account va confirmed webhook subscriptiondan keyin accountni saqlaydi.

## 7. Authentication

- HttpOnly, SameSite=Lax session cookie.
- Production HTTPS va Secure cookie.
- Raw session token DB’da saqlanmaydi.
- Mutations CSRF header talab qiladi.
- Login/reset rate limited.
- Email verification talab qilinadi.

## 8. Inbox

- Faqat verified Meta inbound message event reply window ochadi.
- Duplicate inbound message unread count/reply window’ni takror oshirmaydi.
- Manual send client request ID bilan idempotent.
- Provider reject/ambiguity sent deb ko‘rsatilmaydi.

## 9. Analytics

- Faqat `webhook_events`, `automation_executions` va succeeded private actionlardan hisoblanadi.
- Fake seed/placeholder ko‘rsatkich yo‘q.
- “Conversion” biznes savdosi emas; DM/comment delivery ulushi deb nomlanadi.

## 10. Non-functional talablar

- Multi-tenant isolation har query’da.
- Additive migration va production data preservation.
- Provider timeout va redacted structured log.
- Durable queue process restartdan tiklanadi.
- Responsive UI: 360/768/1440.
- Loading/error/empty/retry state.
- Uzbek-first interface.

## 11. Acceptance criteria

Code-level:

- Go test/vet/build pass.
- Frontend lint/test/production build pass.
- Real PostgreSQL integration pass.
- Follower/not-follower/unknown/disabled decision tests.
- Duplicate private/public reply negative tests.
- Private success/public retry split test.
- Cross-tenant negative test.

Live Meta:

- real OAuth/token/scopes;
- signed real comment webhook;
- eligible follow true/false/unknown;
- real private reply;
- real public reply only after private success;
- duplicate comment no duplicate delivery;
- real rejected/expired/rate-limit behavior.

Live Meta acceptance bajarilmaguncha loyiha to‘liq yakunlangan deb belgilanmaydi.
