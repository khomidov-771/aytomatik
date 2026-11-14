"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "./logo";
import { PreferencesControls, usePreferences } from "./preferences-provider";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  const { tr } = usePreferences();
  return <main className="auth-page">
    <div className="auth-ambient one" /><div className="auth-ambient two" />
    <section className="auth-brand-panel"><Logo /><div className="auth-promise"><span className="hero-kicker">Instagram Automation</span><h1>{tr("Commentlarni suhbatga, suhbatni savdoga aylantiring.", "Превращайте комментарии в диалоги, а диалоги — в продажи.", "Turn comments into conversations and conversations into sales.")}</h1><p>{tr("Rasmiy API, xavfsiz OAuth va tushunarli avtomatlashtirish.", "Официальный API, безопасный OAuth и понятная автоматизация.", "Official APIs, secure OAuth, and clear automation.")}</p><ul><li><CheckCircle2 /> Multi-tenant workspace</li><li><CheckCircle2 /> Idempotent Comment-to-DM</li><li><CheckCircle2 /> {tr("Real eventlardan analitika", "Аналитика реальных событий", "Analytics from real events")}</li></ul></div><small>© 2026 REPLEO</small></section>
    <section className="auth-form-panel"><div className="auth-preferences"><PreferencesControls /></div><Link className="back-link" href="/"><ArrowLeft size={16} /> {tr("Bosh sahifa", "На главную", "Home")}</Link><div className="auth-card"><div className="mobile-auth-logo"><Logo /></div><div className="auth-heading"><h1>{title}</h1><p>{subtitle}</p></div>{children}<div className="auth-footer">{footer}</div></div></section>
  </main>;
}

