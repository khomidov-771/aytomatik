import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "./logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) { return <main className="auth-page"><div className="auth-ambient one"/><div className="auth-ambient two"/><section className="auth-brand-panel"><Logo/><div className="auth-promise"><span className="hero-kicker">Instagram Automation SaaS</span><h1>Commentlarni suhbatga, suhbatni savdoga aylantiring.</h1><p>Rasmiy API, xavfsiz OAuth va tushunarli avtomatlashtirish.</p><ul><li><CheckCircle2/> Multi-tenant workspace</li><li><CheckCircle2/> Idempotent comment-to-DM</li><li><CheckCircle2/> Real eventlardan analitika</li></ul></div><small>© 2026 IDS Automate</small></section><section className="auth-form-panel"><Link className="back-link" href="/"><ArrowLeft size={16}/> Bosh sahifa</Link><div className="auth-card"><div className="mobile-auth-logo"><Logo/></div><div className="auth-heading"><h1>{title}</h1><p>{subtitle}</p></div>{children}<div className="auth-footer">{footer}</div></div></section></main>; }

