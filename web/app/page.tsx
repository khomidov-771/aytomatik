"use client";

import Link from "next/link";
import { ArrowRight, Check, Instagram, MessageCircle, Send, ShieldCheck, UserCheck, Zap } from "lucide-react";
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
      <section className="hero" id="product">
        <div className="hero-glow" />
        <div className="hero-copy" data-reveal="left">
          <span className="hero-kicker"><Instagram size={15}/>{tr("Instagram uchun comment avtomatizatsiyasi", "Автоматизация комментариев Instagram", "Instagram comment automation")}</span>
          <h1>{tr("Kommentdan mijozgacha —", "От комментария до клиента —", "From comment to customer —")} <span>{tr("avtomatik ravishda", "автоматически", "automatically")}</span></h1>
          <p>{tr("Reels va post kommentlariga avtomatik javob bering, Direct xabar yuboring va jarayonni bitta joydan boshqaring.", "Автоматически отвечайте на комментарии к Reels и публикациям, отправляйте сообщения в Direct и управляйте процессом из одного места.", "Reply to Reels and post comments automatically, send Direct messages, and manage the workflow in one place.")}</p>
          <div className="hero-actions"><Link className="btn primary large" href="/register">{tr("Bepul boshlash", "Начать бесплатно", "Get started free")} <ArrowRight size={18} /></Link><Link className="btn secondary large" href="/#guide"><span className="play-icon"/> {tr("Qanday ishlaydi?", "Как это работает?", "How it works")}</Link></div>
          <div className="hero-proof-list"><span><Check/>{tr("Tez sozlash", "Быстрая настройка", "Quick setup")}</span><span><Check/>{tr("Xavfsiz ulanish", "Безопасное подключение", "Secure connection")}</span><span><Check/>{tr("Rasmiy Meta API", "Официальный API Meta", "Official Meta API")}</span></div>
        </div>
        <div className="hero-visual" data-reveal="scale" aria-label={tr("Comment va Direct javobining ko‘rgazmali namunasi", "Иллюстрация комментария и ответа в Direct", "Illustration of a comment and Direct reply")}>
          <div className="hero-phone-orbit"/>
          <div className="hero-phone">
            <div className="hero-phone-top"><span>9:41</span><i/><span>•••</span></div>
            <div className="hero-phone-title"><Instagram size={15}/><strong>Reels</strong><span>•••</span></div>
            <div className="hero-phone-art"><span className="hero-phone-art-play">▶</span><small>{tr("VIZUAL NAMUNA", "ВИЗУАЛЬНЫЙ ПРИМЕР", "VISUAL EXAMPLE")}</small></div>
            <div className="hero-phone-caption"><strong>{tr("Post kommenti", "Комментарий к публикации", "Post comment")}</strong><p>{tr("Izohdan Direct javobigacha", "От комментария до ответа в Direct", "From comment to Direct reply")}</p></div>
            <div className="hero-phone-comment"><MessageCircle/><span>{tr("Narxi qancha?", "Сколько стоит?", "How much does it cost?")}</span></div>
            <div className="hero-phone-reply"><Send/><span><small>{tr("JAVOB SHABLONI", "ШАБЛОН ОТВЕТА", "REPLY TEMPLATE")}</small><strong>{tr("Batafsil ma’lumot — Direct’da", "Подробности — в Direct", "More details in Direct")}</strong></span></div>
          </div>
          <div className="hero-replio-orb" aria-hidden="true"><span>R</span></div>
          <div className="hero-float-chip"><span><MessageCircle/></span><div><strong>{tr("Comment", "Комментарий", "Comment")}</strong><small>{tr("Kalit so‘z misoli: “narx”", "Пример ключевого слова: «цена»", "Keyword example: “price”")}</small></div></div>
          <div className="hero-float-send"><span><Send/></span>{tr("Private reply → public javob", "Личный ответ → публичный", "Private reply → public reply")}</div>
        </div>
      </section>

      <section className="trust-strip" aria-label={tr("Platforma afzalliklari", "Преимущества платформы", "Platform benefits")} id="safety">
        <div data-reveal><strong>{tr("Tez sozlash", "Быстрая настройка", "Quick setup")}</strong><span>{tr("Post va javoblar bir oqimda", "Публикация и ответы в одном процессе", "Post and replies in one workflow")}</span></div>
        <div data-reveal><strong>{tr("Xavfsiz ulanish", "Безопасное подключение", "Secure connection")}</strong><span>{tr("Parol saqlanmaydi", "Пароль не хранится", "Password is never stored")}</span></div>
        <div data-reveal><strong>{tr("Rasmiy Meta API", "Официальный API Meta", "Official Meta API")}</strong><span>{tr("Faqat ruxsat berilgan amallar", "Только разрешённые действия", "Permission-based actions")}</span></div>
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
      <section className="cta-panel" id="help" data-reveal="scale"><div><span className="section-label">{tr("Boshlash", "Начать", "Get started")}</span><h2>{tr("Birinchi qoidangizni bugun sozlang.", "Настройте первое правило сегодня.", "Set up your first rule today.")}</h2><p>{tr("Instagramni ulang, postni tanlang va yuboriladigan javoblarni o‘zingiz belgilang.", "Подключите Instagram, выберите публикацию и задайте тексты ответов.", "Connect Instagram, select a post, and write the replies you want to send.")}</p></div><Link className="btn primary large" href="/register">{tr("Bepul boshlash", "Начать бесплатно", "Get started free")} <ArrowRight /></Link></section>
    </main>
    <footer className="public-footer"><Logo /><p>{tr("Har bir comment suhbatni boshlaydi.", "Каждый комментарий начинает диалог.", "Every comment starts a conversation.")}</p><div><Link href="/setup">{tr("Instagram ulash", "Подключить Instagram", "Connect Instagram")}</Link><Link href="/terms">{tr("Shartlar", "Условия", "Terms")}</Link><span>© 2026 REPLIO</span></div></footer>
  </div>;
}

