"use client";

import Link from "next/link";
import { ArrowRight, Check, MessageCircle, Send, ShieldCheck, UserCheck, Zap } from "lucide-react";
import { Logo } from "@/components/logo";
import { PublicHeader } from "@/components/public-header";
import { usePreferences } from "@/components/preferences-provider";
import { MotionReveal } from "@/components/motion-reveal";

export default function LandingPage() {
  const { tr } = usePreferences();
  const features = [
    { icon: MessageCircle, title: tr("Commentdan Direct’ga", "Из комментария в Direct", "Comment to Direct"), text: tr("Kalit so‘zli commentni aniqlab, Meta ruxsat bergan private reply’ni yuboradi.", "Находит комментарий по ключевому слову и отправляет разрешённый Meta личный ответ.", "Detects a keyword comment and sends the private reply allowed by Meta.") },
    { icon: UserCheck, title: tr("Ixtiyoriy follow tekshiruvi", "Опциональная проверка подписки", "Optional follow check"), text: tr("Natija FOLLOWER, NOT_FOLLOWER yoki UNKNOWN bo‘ladi. API xatosi hech qachon NOT_FOLLOWER deb talqin qilinmaydi.", "Результат: FOLLOWER, NOT_FOLLOWER или UNKNOWN. Ошибка API никогда не считается NOT_FOLLOWER.", "The result is FOLLOWER, NOT_FOLLOWER, or UNKNOWN. API errors are never treated as NOT_FOLLOWER.") },
    { icon: Zap, title: tr("Xavfsiz ketma-ketlik", "Безопасная последовательность", "Safe ordering"), text: tr("Public “DM yuborildi” javobi faqat private reply Meta tomonidan muvaffaqiyatli qabul qilingandan keyin yuboriladi.", "Публичный ответ «DM отправлен» публикуется только после подтверждённого Meta личного ответа.", "The public “DM sent” reply is posted only after Meta confirms the private reply.") },
    { icon: ShieldCheck, title: tr("Audit va idempotency", "Аудит и идемпотентность", "Audit and idempotency"), text: tr("Har bir urinish, natija va xato alohida saqlanadi; takroriy webhook dublikat xabar yubormaydi.", "Каждая попытка, результат и ошибка сохраняются отдельно; повторный webhook не создаёт дубликаты.", "Every attempt, result, and error is stored separately; duplicate webhooks do not send duplicate messages.") },
  ];

  return <div className="marketing-page">
    <MotionReveal />
    <PublicHeader />
    <main>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy" data-reveal="left">
          <span className="hero-kicker">{tr("INSTAGRAM COMMENT-TO-DM", "АВТОМАТИЗАЦИЯ INSTAGRAM-КОММЕНТАРИЕВ", "INSTAGRAM COMMENT AUTOMATION")}</span>
          <h1>{tr("Instagram izohlariga", "Автоматизируйте ответы на", "Automate replies to")} <span>{tr("tez javob bering", "комментарии Instagram", "Instagram comments")}</span></h1>
          <p>{tr("Kalit so‘z va javob matnini bir marta belgilang. Yangi mos izoh kelganda IDS Automate tanlangan qoidani rasmiy Meta API orqali bajaradi.", "Один раз задайте ключевые слова и ответы. Когда появится подходящий комментарий, IDS Automate выполнит правило через официальный API Meta.", "Set keywords and replies once. When a matching comment arrives, IDS Automate runs the rule through Meta’s official API.")}</p>
          <div className="hero-actions"><Link className="btn primary large" href="/register">{tr("Instagramni ulash", "Подключить Instagram", "Connect Instagram")} <ArrowRight size={18} /></Link><Link className="hero-secondary-link" href="/#guide">{tr("Qanday ishlaydi", "Как это работает", "How it works")}</Link></div>
          <div className="hero-note"><ShieldCheck size={16} /> {tr("Instagram paroli so‘ralmaydi. Ulanish rasmiy Meta oynasida bo‘ladi.", "Пароль Instagram не запрашивается. Подключение проходит через официальный экран Meta.", "Your Instagram password is never requested. Connection uses Meta’s official sign-in.")}</div>
        </div>
        <div className="hero-visual" data-reveal="scale" aria-label={tr("Comment-to-DM oqimining uch bosqichi", "Три шага Comment-to-DM", "Three steps in the Comment-to-DM flow")}>
          <section className="hero-sequence" aria-label={tr("Comment-to-DM jarayoni sxemasi", "Схема процесса Comment-to-DM", "Comment-to-DM workflow diagram")}>
            <header className="hero-sequence-heading">
              <div><span>{tr("COMMENT → DIRECT · OQIM SXEMASI", "COMMENT → DIRECT · СХЕМА", "COMMENT → DIRECT · WORKFLOW")}</span><h2>{tr("Izohdan Direct’gacha", "От комментария до Direct", "From comment to Direct")}</h2></div>
              <span className="hero-sequence-index"><i />{tr("3 bosqich", "3 шага", "3 steps")}</span>
            </header>
            <div className="hero-flow-scene" role="img" aria-label={tr("Namunaviy izoh, kalit so‘z mosligi va Direct javobining ketma-ketlik sxemasi", "Схема: пример комментария, совпадение ключевого слова и ответ в Direct", "Illustrative sequence: sample comment, keyword match, and Direct reply")}>
              <svg className="hero-flow-track" viewBox="0 0 560 430" fill="none" aria-hidden="true" preserveAspectRatio="none">
                <path className="hero-flow-track-base" d="M375 104C485 126 438 174 363 190" />
                <path className="hero-flow-track-base" d="M207 248C103 270 139 317 246 337" />
                <path className="hero-flow-track-light" d="M375 104C485 126 438 174 363 190" />
                <path className="hero-flow-track-light flow-track-second" d="M207 248C103 270 139 317 246 337" />
                <circle r="5" className="hero-flow-particle"><animateMotion dur="3.6s" repeatCount="indefinite" path="M375 104C485 126 438 174 363 190" /></circle>
                <circle r="5" className="hero-flow-particle particle-second"><animateMotion dur="3.6s" begin="1.8s" repeatCount="indefinite" path="M207 248C103 270 139 317 246 337" /></circle>
              </svg>
              <article className="hero-flow-card hero-flow-comment">
                <div className="hero-flow-card-top"><span className="hero-flow-icon comment-icon"><MessageCircle /></span><span className="hero-flow-step">01 <i>/</i> COMMENT</span><span className="hero-flow-arrival"><i />{tr("Yangi izoh", "Новый комментарий", "New comment")}</span></div>
                <div className="hero-flow-message"><small>{tr("IZOH NAMUNASI", "ПРИМЕР КОММЕНТАРИЯ", "SAMPLE COMMENT")}</small><strong>“{tr("Narxi qancha?", "Сколько стоит?", "How much does it cost?")}”</strong></div>
              </article>
              <article className="hero-flow-card hero-flow-match">
                <div className="hero-flow-card-top"><span className="hero-flow-icon match-icon"><Zap /></span><span className="hero-flow-step">02 <i>/</i> MATCH</span><span className="hero-flow-match-label"><Check />{tr("Mos keldi", "Совпало", "Matched")}</span></div>
                <div className="hero-flow-match-row"><span>{tr("Kalit so‘z", "Ключевое слово", "Keyword")}</span><strong>narx</strong><span className="hero-flow-match-rule">{tr("aniq moslik", "точное совпадение", "exact match")}</span></div>
              </article>
              <article className="hero-flow-card hero-flow-reply">
                <div className="hero-flow-card-top"><span className="hero-flow-icon reply-icon"><Send /></span><span className="hero-flow-step">03 <i>/</i> PRIVATE REPLY</span></div>
                <div className="hero-flow-reply-bubble">{tr("Assalomu alaykum! Batafsil ma’lumotni Direct orqali yuboramiz.", "Здравствуйте! Подробности отправим вам в Direct.", "Hello! We’ll send the details to your Direct messages.")}</div>
                <div className="hero-flow-public"><span><Check /></span>{tr("DM tasdiqlansa, keyin public javob", "Публичный ответ — после успешного DM", "Public reply after DM is confirmed")}</div>
              </article>
            </div>
            <footer className="hero-sequence-footer"><ShieldCheck/><span>{tr("Bu — qoida qanday ishlashini ko‘rsatuvchi sxema.", "Это схема последовательности работы правила.", "A diagram of the rule sequence, not a live event.")}</span></footer>
          </section>
        </div>
      </section>

      <section className="trust-strip" aria-label={tr("Platforma tamoyillari", "Принципы платформы", "Platform principles")} id="safety">
        <div data-reveal><strong>{tr("Rasmiy Meta API", "Официальный API Meta", "Official Meta API")}</strong><span>{tr("Ruxsat bilan ulanish", "Подключение с разрешением", "Permission-based connection")}</span></div>
        <div data-reveal><strong>{tr("Parol saqlanmaydi", "Пароль не хранится", "Password is not stored")}</strong><span>{tr("Faqat OAuth token ishlatiladi", "Используется только OAuth-токен", "Only an OAuth token is used")}</span></div>
        <div data-reveal><strong>{tr("Harakatlar jurnali", "Журнал действий", "Action history")}</strong><span>{tr("Natija va xatolar alohida", "Результаты и ошибки отдельно", "Outcomes and errors kept separate")}</span></div>
        <div data-reveal><strong>{tr("Dublikatdan himoya", "Защита от дублей", "Duplicate protection")}</strong><span>{tr("Bir commentga takror javob yo‘q", "Без повторного ответа на комментарий", "No duplicate reply per comment")}</span></div>
      </section>

      <section className="marketing-section" id="features">
        <div className="section-heading" data-reveal><span>{tr("Imkoniyatlar", "Возможности", "Capabilities")}</span><h2>{tr("Kerakli ishlar, ortiqcha murakkabliksiz", "Нужные инструменты без лишней сложности", "The tools you need, without extra complexity")}</h2><p>{tr("Commentni aniqlashdan javob natijasigacha — bitta tushunarli joyda.", "От обнаружения комментария до результата ответа — всё в одном понятном месте.", "From matching a comment to reviewing the reply outcome, in one clear workspace.")}</p></div>
        <div className="feature-grid">{features.map(({ icon: Icon, ...item }, index) => <article className="feature-card" data-reveal key={item.title}><span className="feature-index">0{index + 1}</span><span className="feature-icon"><Icon /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="workflow-section" id="guide">
        <div className="workflow-copy" data-reveal="left"><span className="section-label">{tr("Javob siyosati", "Правила ответа", "Reply policy")}</span><h2>{tr("Aniq siyosat. Taxminsiz javob.", "Понятные правила. Без догадок.", "Clear rules. No guesswork.")}</h2><p>{tr("Meta follow holatini aniqlay olmasa, tizim foydalanuvchini obuna bo‘lmagan deb belgilamaydi. Workspace egasi noma’lum holat uchun amalni oldindan tanlaydi.", "Если Meta не может определить подписку, система не считает пользователя неподписанным. Владелец workspace заранее выбирает действие для неизвестного статуса.", "If Meta cannot determine follow status, the system does not assume the person is a non-follower. The workspace owner chooses the fallback in advance.")}</p></div>
        <div className="workflow-outcomes" data-reveal="scale" aria-label={tr("Follow natijalariga ko‘ra bajariladigan amallar", "Действия по результату проверки подписки", "Actions by follow-check outcome")}>
          <div><span className="outcome-status follower">FOLLOWER</span><p>{tr("Private reply muvaffaqiyatli bo‘lsa, keyin public javob.", "После успешного личного ответа публикуется комментарий.", "Post the public reply only after private delivery succeeds.")}</p></div>
          <div><span className="outcome-status not-follower">NOT_FOLLOWER</span><p>{tr("DM yuborilmaydi. Obuna bo‘lishga chaqiruvchi public javob.", "Без DM. Публикуется просьба подписаться.", "Skip the DM and publish the configured follow prompt.")}</p></div>
          <div><span className="outcome-status unknown">UNKNOWN</span><p>{tr("Oldindan tanlangan fallback ishlaydi; status taxmin qilinmaydi.", "Применяется выбранное действие; статус не угадывается.", "Use the selected fallback; never guess the status.")}</p></div>
        </div>
      </section>
      <section className="cta-panel" data-reveal="scale"><div><span className="section-label">{tr("Boshlash", "Начать", "Get started")}</span><h2>{tr("Birinchi qoidangizni bugun sozlang.", "Настройте первое правило сегодня.", "Set up your first rule today.")}</h2><p>{tr("Instagramni ulang, postni tanlang va yuboriladigan javoblarni o‘zingiz belgilang.", "Подключите Instagram, выберите публикацию и задайте тексты ответов.", "Connect Instagram, select a post, and write the replies you want to send.")}</p></div><Link className="btn primary large" href="/register">{tr("Instagramni ulash", "Подключить Instagram", "Connect Instagram")} <ArrowRight /></Link></section>
    </main>
    <footer className="public-footer"><Logo /><p>Instagram Comment-to-DM · Official Meta API</p><div><Link href="/setup">{tr("Instagram ulash", "Подключить Instagram", "Connect Instagram")}</Link><Link href="/terms">{tr("Shartlar", "Условия", "Terms")}</Link><span>© 2026 IDS Automate</span></div></footer>
  </div>;
}
