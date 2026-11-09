import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export function DemoBadge({ show = true }: { show?: boolean }) { return show ? <span className="demo-badge"><span /> Demo rejim</span> : null; }
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) { return <div className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-actions">{action}</div>}</div>; }
export function LoadingState({ label = "Yuklanmoqda..." }: { label?: string }) { return <div className="state-card"><LoaderCircle className="spin" size={24}/><span>{label}</span></div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="state-card error-state"><AlertCircle size={24}/><div><strong>Ma’lumot olinmadi</strong><p>{message}</p></div>{retry && <button className="btn secondary small" onClick={retry}>Qayta urinish</button>}</div>; }
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Inbox size={24}/></span><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function StatusPill({ status }: { status: string }) { const good = ["connected", "active", "sent", "open", "owner", "manager"].includes(status.toLowerCase()); return <span className={`status-pill ${good ? "good" : status === "disconnected" || status === "failed" ? "bad" : "warn"}`}><span/>{status}</span>; }

