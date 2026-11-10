"use client";

import Link from "next/link";
import { ArrowRight, Check, MessageCircle, MousePointerClick, ShieldCheck, Sparkles, UserCheck, Zap } from "lucide-react";
import { InstagramOrb } from "@/components/marketing-icons";
import { Logo } from "@/components/logo";
import { PublicHeader } from "@/components/public-header";
import { usePreferences } from "@/components/preferences-provider";

export default function LandingPage() {
  const { tr } = usePreferences();
  const features = [
    { icon: MessageCircle, title: tr("Commentdan Direct’ga", "Из комментария в Direct", "Comment to Direct"), text: tr("Kalit so‘zli commentni aniqlab, Meta ruxsat bergan private reply’ni yuboradi.", "Находит комментарий по ключевому слову и отправляет разрешённый Meta личный ответ.", "Detects a keyword comment and sends the private reply allowed by Meta.") },
    { icon: UserCheck, title: tr("Ixtiyoriy follow tekshiruvi", "Опциональная проверка подписки", "Optional follow check"), text: tr("Natija FOLLOWER, NOT_FOLLOWER yoki UNKNOWN bo‘ladi. API xatosi hech qachon NOT_FOLLOWER deb talqin qilinmaydi.", "Результат: FOLLOWER, NOT_FOLLOWER или UNKNOWN. Ошибка API никогда не считается NOT_FOLLOWER.", "The result is FOLLOWER, NOT_FOLLOWER, or UNKNOWN. API errors are never treated as NOT_FOLLOWER.") },
    { icon: Zap, title: tr("Xavfsiz ketma-ketlik", "Безопасная последовательность", "Safe ordering"), text: tr("Public “DM yuborildi” javobi faqat private reply Meta tomonidan muvaffaqiyatli qabul qilingandan keyin yuboriladi.", "Публичный ответ «DM отправлен» публикуется только после подтверждённого Meta личного ответа.", "The public “DM sent” reply is posted only after Meta confirms the private reply.") },
    { icon: ShieldCheck, title: tr("Audit va idempotency", "Аудит и идемпотентность", "Audit and idempotency"), text: tr("Har bir urinish, natija va xato alohida saqlanadi; takroriy webhook dublikat xabar yubormaydi.", "Каждая попытка, результат и ошибка сохраняются отдельно; повторный webhook не создаёт дубликаты.", "Every attempt, result, and error is stored separately; duplicate webhooks do not send duplicate messages.") },
  ];

  return <div className="marketing-page">
    <PublicHeader />
    <main>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={15} /> {tr("Instagram Professional uchun rasmiy automation", "Официальная автоматизация для Instagram Professional", "Official automation for Instagram Professional")}</span>
          <h1>{tr("Commentni", "Превращайте", "Turn comments into")} <span>{tr("aniq va xavfsiz", "точно и безопасно", "precise and safe")}</span> {tr("Direct oqimiga aylantiring", "комментарии в Direct", "Direct conversations")}</h1>
          <p>{tr("Real comment → keyword match → ixtiyoriy follow tekshiruvi → private reply → tasdiqlangandan keyin public javob.", "Реальный комментарий → ключевое слово → проверка подписки → личный ответ → публичный ответ после подтверждения.", "Real comment → keyword match → optional follow check → private reply → public reply after confirmation.")}</p>
          <div className="hero-actions"><Link className="btn primary large" href="/register">{tr("Workspace yaratish", "Создать workspace", "Create workspace")} <ArrowRight size={18} /></Link><Link className="btn secondary large" href="/login">{tr("Kirish", "Войти", "Sign in")}</Link></div>
          <div className="hero-note"><ShieldCheck size={16} /> {tr("Instagram paroli so‘ralmaydi. Faqat rasmiy Meta API.", "Пароль Instagram не запрашивается. Только официальный Meta API.", "We never ask for your Instagram password. Official Meta API only.")}</div>
        </div>
        <InstagramOrb />
      </section>

      <section className="trust-strip" aria-label={tr("Platforma tamoyillari", "Принципы платформы", "Platform principles")} id="safety">
        <div><strong>Official API</strong><span>{tr("Scraping va private API yo‘q", "Без scraping и private API", "No scraping or private APIs")}</span></div>
        <div><strong>Fail closed</strong><span>{tr("Noma’lum holat aniq ko‘rsatiladi", "Неизвестный статус показан явно", "Unknown states are explicit")}</span></div>
        <div><strong>Idempotent</strong><span>{tr("Takroriy reply bloklanadi", "Дубликаты блокируются", "Duplicate replies are blocked")}</span></div>
        <div><strong>Multi-tenant</strong><span>{tr("Workspace ma’lumotlari ajratilgan", "Данные workspace изолированы", "Workspace data is isolated")}</span></div>
      </section>

      <section className="marketing-section" id="features">
        <div className="section-heading"><span>{tr("Asosiy imkoniyatlar", "Основные возможности", "Core capabilities")}</span><h2>{tr("Bitta vazifa, to‘liq nazorat", "Одна задача, полный контроль", "One job, complete control")}</h2><p>{tr("Ortiqcha modullarsiz, faqat haqiqiy Comment-to-DM oqimi.", "Без лишних модулей — только реальный Comment-to-DM поток.", "No unnecessary modules—only the real Comment-to-DM flow.")}</p></div>
        <div className="feature-grid">{features.map(({ icon: Icon, ...item }) => <article className="feature-card" key={item.title}><span className="feature-icon"><Icon /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="workflow-section" id="guide">
        <div className="workflow-copy"><span className="section-label">{tr("Qanday ishlaydi?", "Как это работает?", "How it works")}</span><h2>{tr("Natijaga qarab to‘g‘ri javob", "Правильное действие для каждого результата", "The right response for every outcome")}</h2><p>{tr("Follow tekshiruvi o‘chirilishi yoki qo‘llab-quvvatlanmagan holat uchun workspace egasi aniq fallback siyosatini tanlaydi.", "Владелец workspace выбирает явную fallback-политику, если проверка подписки отключена или недоступна.", "The workspace owner chooses an explicit fallback policy when follow verification is disabled or unavailable.")}</p><ul><li><Check /> FOLLOWER: {tr("private reply, so‘ng muvaffaqiyatli public javob", "личный ответ, затем публичный ответ", "private reply, then public reply")}</li><li><Check /> NOT_FOLLOWER: {tr("DM yo‘q, follow qilishga chaqiruvchi public javob", "без DM, публичная просьба подписаться", "no DM, public follow prompt")}</li><li><Check /> UNKNOWN: {tr("tanlangan fallback qoidasiga qat’iy amal qilinadi", "строго применяется выбранная fallback-политика", "the selected fallback policy is applied")}</li></ul></div>
        <div className="workflow-canvas"><div className="flow-node trigger"><MousePointerClick /><span><small>{tr("Trigger", "Триггер", "Trigger")}</small>{tr("Real comment", "Реальный комментарий", "Real comment")}</span></div><ArrowRight /><div className="flow-node condition"><Sparkles /><span><small>{tr("Shart", "Условие", "Condition")}</small>Keyword + follow</span></div><ArrowRight /><div className="flow-node action"><MessageCircle /><span><small>{tr("Harakat", "Действие", "Action")}</small>DM → public reply</span></div></div>
      </section>

      <section className="cta-panel"><div><span className="section-label">{tr("Boshlash", "Начать", "Get started")}</span><h2>{tr("Instagram Professional akkauntingizni ulang.", "Подключите Instagram Professional аккаунт.", "Connect your Instagram Professional account.")}</h2><p>{tr("Meta OAuth, webhook va ruxsatlar tayyor bo‘lgach, real commentlar qayta ishlanadi.", "После настройки Meta OAuth, webhook и разрешений будут обрабатываться реальные комментарии.", "Real comments are processed after Meta OAuth, webhooks, and permissions are ready.")}</p></div><Link className="btn primary large" href="/register">{tr("Workspace yaratish", "Создать workspace", "Create workspace")} <ArrowRight /></Link></section>
    </main>
    <footer className="public-footer"><Logo /><p>Instagram Comment-to-DM · Official Meta API</p><div><Link href="/login">{tr("Kirish", "Войти", "Sign in")}</Link><Link href="/terms">{tr("Shartlar", "Условия", "Terms")}</Link><span>© 2026 IDS Automate</span></div></footer>
  </div>;
}
