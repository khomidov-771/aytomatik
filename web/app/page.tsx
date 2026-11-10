import Link from "next/link";
import { ArrowRight, Check, MessageCircle, MousePointerClick, ShieldCheck, Sparkles, UserCheck, Zap } from "lucide-react";
import { InstagramOrb } from "@/components/marketing-icons";
import { Logo } from "@/components/logo";
import { PublicHeader } from "@/components/public-header";

const features = [
  {icon: MessageCircle, title: "Commentdan Direct’ga", text: "Kalit so‘zli commentni aniqlab, Meta ruxsat bergan private reply’ni yuboradi."},
  {icon: UserCheck, title: "Ixtiyoriy follow tekshiruvi", text: "Natija FOLLOWER, NOT_FOLLOWER yoki UNKNOWN bo‘ladi. API xatosi hech qachon NOT_FOLLOWER deb talqin qilinmaydi."},
  {icon: Zap, title: "Xavfsiz ketma-ketlik", text: "Public “DM yuborildi” javobi faqat private reply Meta tomonidan muvaffaqiyatli qabul qilingandan keyin yuboriladi."},
  {icon: ShieldCheck, title: "Audit va idempotency", text: "Har bir urinish, natija va xato alohida saqlanadi; takroriy webhook dublikat xabar yubormaydi."},
];

export default function LandingPage() {
  return <div className="marketing-page">
    <PublicHeader/>
    <main>
      <section className="hero">
        <div className="hero-glow"/>
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={15}/> Instagram Professional uchun rasmiy automation</span>
          <h1>Commentni <span>aniq va xavfsiz</span> Direct oqimiga aylantiring</h1>
          <p>Real comment → keyword match → ixtiyoriy follow tekshiruvi → private reply → tasdiqlangandan keyin public javob.</p>
          <div className="hero-actions"><Link className="btn primary large" href="/register">Workspace yaratish <ArrowRight size={18}/></Link><Link className="btn secondary large" href="/login">Kirish</Link></div>
          <div className="hero-note"><ShieldCheck size={16}/> Instagram paroli so‘ralmaydi. Faqat rasmiy Meta API.</div>
        </div>
        <InstagramOrb/>
      </section>

      <section className="trust-strip" aria-label="Platforma tamoyillari" id="safety">
        <div><strong>Official API</strong><span>Scraping va private API yo‘q</span></div>
        <div><strong>Fail closed</strong><span>Noma’lum holat aniq ko‘rsatiladi</span></div>
        <div><strong>Idempotent</strong><span>Takroriy reply bloklanadi</span></div>
        <div><strong>Multi-tenant</strong><span>Workspace ma’lumotlari ajratilgan</span></div>
      </section>

      <section className="marketing-section" id="features">
        <div className="section-heading"><span>Asosiy imkoniyatlar</span><h2>Bitta vazifa, to‘liq nazorat</h2><p>Ortiqcha modullarsiz, faqat haqiqiy Comment-to-DM oqimi.</p></div>
        <div className="feature-grid">{features.map(({icon: Icon, ...item}) => <article className="feature-card" key={item.title}><span className="feature-icon"><Icon/></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="workflow-section" id="guide">
        <div className="workflow-copy"><span className="section-label">Qanday ishlaydi?</span><h2>Natijaga qarab to‘g‘ri javob</h2><p>Follow tekshiruvi o‘chirilishi yoki qo‘llab-quvvatlanmagan holat uchun workspace egasi aniq fallback siyosatini tanlaydi.</p><ul><li><Check/> FOLLOWER: private reply, so‘ng muvaffaqiyatli public javob</li><li><Check/> NOT_FOLLOWER: DM yo‘q, follow qilishga chaqiruvchi public javob</li><li><Check/> UNKNOWN: tanlangan fallback qoidasiga qat’iy amal qilinadi</li></ul></div>
        <div className="workflow-canvas"><div className="flow-node trigger"><MousePointerClick/><span><small>Trigger</small>Real comment</span></div><ArrowRight/><div className="flow-node condition"><Sparkles/><span><small>Shart</small>Keyword + follow</span></div><ArrowRight/><div className="flow-node action"><MessageCircle/><span><small>Harakat</small>DM → public reply</span></div></div>
      </section>

      <section className="cta-panel"><div><span className="section-label">Boshlash</span><h2>Instagram Professional akkauntingizni ulang.</h2><p>Meta OAuth, webhook va ruxsatlar tayyor bo‘lgach, real commentlar qayta ishlanadi.</p></div><Link className="btn primary large" href="/register">Workspace yaratish <ArrowRight/></Link></section>
    </main>
    <footer className="public-footer"><Logo/><p>Instagram Comment-to-DM · Rasmiy Meta API · Uzbek-first</p><div><Link href="/login">Kirish</Link><Link href="/terms">Shartlar</Link><span>© 2026 IDS Automate</span></div></footer>
  </div>;
}
