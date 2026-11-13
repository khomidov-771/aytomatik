"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Instagram, MessageCircle, MousePointerClick, Send, ShieldCheck, Sparkles, UserCheck, Zap } from "lucide-react";
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
          <span className="hero-kicker"><Sparkles size={15} /> {tr("Instagram Professional uchun rasmiy automation", "Официальная автоматизация для Instagram Professional", "Official automation for Instagram Professional")}</span>
          <h1>{tr("Instagram izohlarini", "Превращайте комментарии Instagram", "Turn Instagram comments")} <span>{tr("mijoz suhbatiga", "в диалоги с клиентами", "into customer conversations")}</span> {tr("aylantiring", "", "")}</h1>
          <p>{tr("Har bir comment uchun qoidani bir marta sozlang. IDS Automate kalit so‘zni tekshiradi va rasmiy Meta API orqali javob oqimini boshqaradi.", "Настройте правило один раз. IDS Automate проверит ключевое слово и обработает ответы через официальный API Meta.", "Set up a rule once. IDS Automate checks the keyword and orchestrates replies through Meta’s official API.")}</p>
          <div className="hero-actions"><Link className="btn primary large" href="/register">{tr("Instagram bilan ro‘yxatdan o‘tish", "Зарегистрироваться через Instagram", "Sign up with Instagram")} <ArrowRight size={18} /></Link></div>
          <div className="hero-note"><ShieldCheck size={16} /> {tr("Parol so‘ralmaydi · Rasmiy Meta API · Har bir harakat qayd etiladi", "Без запроса пароля · Официальный API Meta · Все действия записываются", "No password collection · Official Meta API · Actions are recorded")}</div>
        </div>
        <div className="hero-visual" data-reveal="scale" aria-label={tr("Comment-to-DM qoidasi qanday ishlashining sxemasi", "Схема работы правила Comment-to-DM", "Diagram of a Comment-to-DM rule")}>
          <div className="hero-board-orbit orbit-one"/><div className="hero-board-orbit orbit-two"/>
          <section className="hero-board" aria-label={tr("Oqim namunasi", "Пример потока", "Flow illustration")}>
            <header className="hero-board-header"><span className="hero-board-brand"><Instagram/></span><span><small>{tr("COMMENT-TO-DM QOIDASI", "ПРАВИЛО COMMENT-TO-DM", "COMMENT-TO-DM RULE")}</small><strong>{tr("Javob oqimi", "Сценарий ответа", "Reply workflow")}</strong></span><span className="hero-board-label">{tr("SXEMA", "СХЕМА", "FLOW")}</span></header>
            <div className="hero-flow-list">
              <article className="hero-flow-card"><span className="hero-flow-icon comment"><MessageCircle/></span><div><small>{tr("1 · TRIGGER", "1 · ТРИГГЕР", "1 · TRIGGER")}</small><strong>{tr("Izoh keladi", "Поступает комментарий", "A comment arrives")}</strong><p>{tr("Tanlangan post yoki Reel’da", "К выбранной публикации или Reel", "On a selected post or Reel")}</p></div><span className="hero-flow-check"><Check/></span></article>
              <div className="hero-flow-link"><span/><ArrowDown/></div>
              <article className="hero-flow-card"><span className="hero-flow-icon keyword"><Sparkles/></span><div><small>{tr("2 · SHART", "2 · УСЛОВИЕ", "2 · CONDITION")}</small><strong>{tr("Kalit so‘zni tekshirish", "Проверка ключевого слова", "Match a keyword")}</strong><p>{tr("Ixtiyoriy follow siyosati bilan", "С опциональной проверкой подписки", "With optional follow policy")}</p></div><span className="hero-flow-check"><Check/></span></article>
              <div className="hero-flow-link"><span/><ArrowDown/></div>
              <article className="hero-flow-card response"><span className="hero-flow-icon reply"><Send/></span><div><small>{tr("3 · JAVOBLAR", "3 · ОТВЕТЫ", "3 · REPLIES")}</small><strong>{tr("Private reply → public javob", "Личный ответ → публичный ответ", "Private reply → public reply")}</strong><p>{tr("Public muvaffaqiyat faqat tasdiqlangan DM’dan keyin", "Публичный success — только после подтверждённого DM", "Public success only after confirmed DM delivery")}</p></div></article>
            </div>
            <footer className="hero-board-footer"><span><ShieldCheck/>{tr("Rasmiy API", "Официальный API", "Official API")}</span><span>{tr("Boshqariladigan qoida", "Управляемое правило", "Owner-controlled rule")}</span></footer>
          </section>
          <div className="hero-orbit-caption"><span className="hero-orbit-dot"/><span>{tr("Aniq sozlama. Tushunarli natija.", "Прозрачная настройка. Понятный результат.", "Clear setup. Traceable outcomes.")}</span></div>
        </div>
      </section>

      <section className="trust-strip" aria-label={tr("Platforma tamoyillari", "Принципы платформы", "Platform principles")} id="safety">
        <div data-reveal style={{transitionDelay:"0ms"}}><strong>Official API</strong><span>{tr("Scraping va private API yo‘q", "Без scraping и private API", "No scraping or private APIs")}</span></div>
        <div data-reveal style={{transitionDelay:"70ms"}}><strong>Fail closed</strong><span>{tr("Noma’lum holat aniq ko‘rsatiladi", "Неизвестный статус показан явно", "Unknown states are explicit")}</span></div>
        <div data-reveal style={{transitionDelay:"140ms"}}><strong>Idempotent</strong><span>{tr("Takroriy reply bloklanadi", "Дубликаты блокируются", "Duplicate replies are blocked")}</span></div>
        <div data-reveal style={{transitionDelay:"210ms"}}><strong>Multi-tenant</strong><span>{tr("Workspace ma’lumotlari ajratilgan", "Данные workspace изолированы", "Workspace data is isolated")}</span></div>
      </section>

      <section className="marketing-section" id="features">
        <div className="section-heading" data-reveal><span>{tr("Asosiy imkoniyatlar", "Основные возможности", "Core capabilities")}</span><h2>{tr("Bitta vazifa, to‘liq nazorat", "Одна задача, полный контроль", "One job, complete control")}</h2><p>{tr("Ortiqcha modullarsiz, faqat haqiqiy Comment-to-DM oqimi.", "Без лишних модулей — только реальный Comment-to-DM поток.", "No unnecessary modules—only the real Comment-to-DM flow.")}</p></div>
        <div className="feature-grid">{features.map(({ icon: Icon, ...item }, index) => <article className="feature-card" data-reveal key={item.title} style={{transitionDelay:`${index * 75}ms`}}><span className="feature-icon"><Icon /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="workflow-section" id="guide" data-reveal="scale">
        <div className="workflow-copy"><span className="section-label">{tr("Qanday ishlaydi?", "Как это работает?", "How it works")}</span><h2>{tr("Natijaga qarab to‘g‘ri javob", "Правильное действие для каждого результата", "The right response for every outcome")}</h2><p>{tr("Follow tekshiruvi o‘chirilishi yoki qo‘llab-quvvatlanmagan holat uchun workspace egasi aniq fallback siyosatini tanlaydi.", "Владелец workspace выбирает явную fallback-политику, если проверка подписки отключена или недоступна.", "The workspace owner chooses an explicit fallback policy when follow verification is disabled or unavailable.")}</p><ul><li><Check /> FOLLOWER: {tr("private reply, so‘ng muvaffaqiyatli public javob", "личный ответ, затем публичный ответ", "private reply, then public reply")}</li><li><Check /> NOT_FOLLOWER: {tr("DM yo‘q, follow qilishga chaqiruvchi public javob", "без DM, публичная просьба подписаться", "no DM, public follow prompt")}</li><li><Check /> UNKNOWN: {tr("tanlangan fallback qoidasiga qat’iy amal qilinadi", "строго применяется выбранная fallback-политика", "the selected fallback policy is applied")}</li></ul></div>
        <div className="workflow-canvas"><div className="flow-node trigger"><MousePointerClick /><span><small>{tr("Trigger", "Триггер", "Trigger")}</small>{tr("Real comment", "Реальный комментарий", "Real comment")}</span></div><ArrowRight /><div className="flow-node condition"><Sparkles /><span><small>{tr("Shart", "Условие", "Condition")}</small>Keyword + follow</span></div><ArrowRight /><div className="flow-node action"><MessageCircle /><span><small>{tr("Harakat", "Действие", "Action")}</small>DM → public reply</span></div></div>
      </section>

      <section className="cta-panel" data-reveal="scale"><div><span className="section-label">{tr("Boshlash", "Начать", "Get started")}</span><h2>{tr("Instagram akkauntingizni bir necha qadamda ulang.", "Подключите Instagram за несколько шагов.", "Connect Instagram in a few simple steps.")}</h2><p>{tr("Rasmiy Meta oynasida akkauntingizni tasdiqlang, post va javob matnini tanlang, so‘ng automation’ni yoqing.", "Подтвердите аккаунт в официальном окне Meta, выберите публикацию и ответы, затем включите автоматизацию.", "Confirm your account in Meta’s official window, choose posts and replies, then turn automation on.")}</p></div><Link className="btn primary large" href="/register">{tr("Instagram bilan ro‘yxatdan o‘tish", "Зарегистрироваться через Instagram", "Sign up with Instagram")} <ArrowRight /></Link></section>
    </main>
    <footer className="public-footer"><Logo /><p>Instagram Comment-to-DM · Official Meta API</p><div><Link href="/setup">{tr("Instagram ulash", "Подключить Instagram", "Connect Instagram")}</Link><Link href="/terms">{tr("Shartlar", "Условия", "Terms")}</Link><span>© 2026 IDS Automate</span></div></footer>
  </div>;
}

