"use client";

import Link from "next/link";
import { ArrowRight, Check, Instagram, MessageCircle, Send, ShieldCheck, UserCheck, Zap } from "lucide-react";
import { Logo } from "@/components/logo";
import { PublicHeader } from "@/components/public-header";
import { usePreferences } from "@/components/preferences-provider";
import { MotionReveal } from "@/components/motion-reveal";
import { ParticleFlow } from "@/components/particle-flow";

export default function LandingPage() {
  const { tr } = usePreferences();
  const features = [
    { icon: MessageCircle, title: tr("Commentdan Direct’ga", "Из комментария в Direct", "Comment to Direct"), text: tr("Kalit so‘zli commentni aniqlab, Meta ruxsat bergan private reply’ni yuboradi.", "Находит комментарий по ключевому слову и отправляет разрешённый Meta личный ответ.", "Detects a keyword comment and sends the private reply allowed by Meta.") },
    { icon: UserCheck, title: tr("Ixtiyoriy follow tekshiruvi", "Опциональная проверка подписки", "Optional follow check"), text: tr("Natija FOLLOWER, NOT_FOLLOWER yoki UNKNOWN bo‘ladi. API xatosi hech qachon NOT_FOLLOWER deb talqin qilinmaydi.", "Результат: FOLLOWER, NOT_FOLLOWER или UNKNOWN. Ошибка API никогда не считается NOT_FOLLOWER.", "The result is FOLLOWER, NOT_FOLLOWER, or UNKNOWN. API errors are never treated as NOT_FOLLOWER.") },
    { icon: Zap, title: tr("Xavfsiz ketma-ketlik", "Безопасная последовательность", "Safe ordering"), text: tr("Public javob Meta private reply muvaffaqiyatini tasdiqlagandan keyingina yuboriladi.", "Публичный ответ отправляется только после подтверждения успешного личного ответа Meta.", "The public reply is sent only after Meta confirms the private reply succeeded.") },
    { icon: ShieldCheck, title: tr("Audit va takrorlanmaslik", "Аудит и защита от повторов", "Audit and deduplication"), text: tr("Har bir urinish va natija qayd etiladi; takroriy webhook dublikat xabar yubormaydi.", "Каждая попытка и результат фиксируются; повторный webhook не создаёт дубликат сообщения.", "Every attempt and outcome is recorded; duplicate webhooks do not send duplicate messages.") },
  ];

  return <div className="marketing-page">
    <MotionReveal />
    <PublicHeader />
    <main>
      <section className="hero" id="product" aria-labelledby="hero-title">
        <div className="hero-copy" data-reveal="left">
          <span className="hero-kicker"><Instagram size={14} aria-hidden="true" />{tr("Instagram uchun comment avtomatizatsiyasi", "Автоматизация комментариев Instagram", "Instagram comment automation")}</span>
          <h1 id="hero-title">{tr("Commentdan Direct’ga —", "Из комментария в Direct —", "From comment to Direct —")} <span>{tr("javoblar o‘z vaqtida.", "ответы приходят вовремя.", "replies, right on time.")}</span></h1>
          <p>{tr("Reels va post izohlariga mos javoblarni avtomatik yuboring. Qoidalarni o‘zingiz belgilang, natijalarni kuzating.", "Автоматически отвечайте на комментарии к Reels и публикациям. Настраивайте правила и отслеживайте результат.", "Automatically reply to relevant comments on Reels and posts. Set your own rules and follow each outcome.")}</p>
          <div className="hero-actions">
            <Link className="btn primary large" href="/setup">{tr("Bepul boshlash", "Начать бесплатно", "Get started free")}<ArrowRight size={17} aria-hidden="true" /></Link>
            <Link className="btn secondary large" href="/#guide"><span className="play-icon" aria-hidden="true" />{tr("Qanday ishlaydi?", "Как это работает?", "How it works")}</Link>
          </div>
          <div className="hero-proof-list">
            <span><Check aria-hidden="true" />{tr("Rasmiy Meta API", "Официальный API Meta", "Official Meta API")}</span>
            <span><Check aria-hidden="true" />{tr("Parol so‘ralmaydi", "Пароль не запрашивается", "No password requested")}</span>
            <span><Check aria-hidden="true" />{tr("Har bir amal qayd etiladi", "Каждое действие записывается", "Every action is recorded")}</span>
          </div>
        </div>
        <ParticleFlow
          accessibleLabel={tr("Comment, kalit so‘z va Direct bosqichlarini bog‘lovchi animatsiyali oqim", "Анимированный поток связывает комментарий, ключевое слово и Direct", "An animated flow connects a comment, keyword, and Direct message")}
          commentLabel={tr("Izoh", "Комментарий", "Comment")}
          keywordLabel={tr("Kalit so‘z", "Ключевое слово", "Keyword")}
          directLabel={tr("Direct", "Direct", "Direct")}
        />
      </section>

      <section className="journey-track" aria-label={tr("Avtomatlashtirish oqimi", "Поток автоматизации", "Automation flow")}>
        <div data-reveal><span className="journey-number">01</span><strong>{tr("Real comment", "Реальный комментарий", "Real comment")}</strong></div>
        <i aria-hidden="true" />
        <div data-reveal><span className="journey-number">02</span><strong>{tr("Kalit so‘z", "Ключевое слово", "Keyword match")}</strong></div>
        <i aria-hidden="true" />
        <div data-reveal><span className="journey-number">03</span><strong>{tr("Private reply → public javob", "Личный ответ → публичный ответ", "Private reply → public reply")}</strong></div>
      </section>

      <section className="marketing-section" id="features">
        <div className="section-heading" data-reveal>
          <span>{tr("Aniq jarayon", "Понятный процесс", "A clear workflow")}</span>
          <h2>{tr("Bitta qoida. Har bir izohga aniq javob.", "Одно правило. Точный ответ на каждый комментарий.", "One rule. A clear response to every comment.")}</h2>
          <p>{tr("Postni tanlang, kalit so‘z va xabar matnini belgilang. Qolgan jarayonni REPLEO kuzatadi.", "Выберите публикацию, задайте ключевые слова и текст ответа. REPLEO проследит за процессом.", "Choose a post, set keywords and message copy. REPLEO tracks the rest of the workflow.")}</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, ...item }, index) => <article className="feature-card" data-reveal key={item.title}>
            <span className="feature-index">0{index + 1}</span><span className="feature-icon"><Icon aria-hidden="true" /></span>
            <h3>{item.title}</h3><p>{item.text}</p>
          </article>)}
        </div>
      </section>

      <section className="workflow-section" id="guide">
        <div className="workflow-copy" data-reveal="left">
          <span className="section-label">{tr("Javob siyosati", "Правила ответа", "Reply policy")}</span>
          <h2>{tr("Aniq siyosat. Taxminsiz javob.", "Понятные правила. Без догадок.", "Clear rules. No guesswork.")}</h2>
          <p>{tr("Meta follow holatini aniqlay olmasa, tizim foydalanuvchini obuna bo‘lmagan deb belgilamaydi. Workspace egasi noma’lum holat uchun amalni oldindan tanlaydi.", "Если Meta не может определить подписку, система не считает пользователя неподписанным. Владелец workspace заранее выбирает действие для неизвестного статуса.", "If Meta cannot determine follow status, REPLEO does not assume the person is not following. The workspace owner chooses the fallback in advance.")}</p>
        </div>
        <div className="workflow-outcomes" id="safety" data-reveal="scale" aria-label={tr("Follow natijalariga ko‘ra bajariladigan amallar", "Действия по результату проверки подписки", "Actions by follow-check outcome")}>
          <div><span className="outcome-status follower">FOLLOWER</span><p>{tr("Private reply muvaffaqiyatli bo‘lsa, keyin public javob.", "После успешного личного ответа публикуется комментарий.", "Post the public reply only after private delivery succeeds.")}</p></div>
          <div><span className="outcome-status not-follower">NOT_FOLLOWER</span><p>{tr("DM yuborilmaydi. Obuna bo‘lishga chaqiruvchi public javob.", "Без DM. Публикуется просьба подписаться.", "Skip the DM and publish the configured follow prompt.")}</p></div>
          <div><span className="outcome-status unknown">UNKNOWN</span><p>{tr("Oldindan tanlangan fallback ishlaydi; status taxmin qilinmaydi.", "Применяется выбранное действие; статус не угадывается.", "Use the selected fallback; never guess the status.")}</p></div>
        </div>
      </section>

      <section className="cta-panel" id="help" data-reveal="scale">
        <div><span className="section-label">{tr("Boshlash", "Начать", "Get started")}</span><h2>{tr("Birinchi qoidangizni bugun sozlang.", "Настройте первое правило сегодня.", "Set up your first rule today.")}</h2><p>{tr("Instagramni ulang, postni tanlang va yuboriladigan javoblarni o‘zingiz belgilang.", "Подключите Instagram, выберите публикацию и задайте тексты ответов.", "Connect Instagram, select a post, and write the replies you want to send.")}</p></div>
        <Link className="btn primary large" href="/setup">{tr("Bepul boshlash", "Начать бесплатно", "Get started free")}<ArrowRight aria-hidden="true" /></Link>
      </section>
    </main>
    <footer className="public-footer"><Logo /><p>{tr("Har bir comment suhbatni boshlaydi.", "Каждый комментарий начинает диалог.", "Every comment starts a conversation.")}</p><div><Link href="/setup">{tr("Instagram ulash", "Подключить Instagram", "Connect Instagram")}</Link><Link href="/terms">{tr("Shartlar", "Условия", "Terms")}</Link><span>© 2026 REPLEO</span></div></footer>
  </div>;
}
