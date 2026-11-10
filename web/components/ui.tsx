"use client";

import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { usePreferences } from "./preferences-provider";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-actions">{action}</div>}</div>;
}

export function LoadingState({ label }: { label?: string }) {
  const { tr } = usePreferences();
  return <div className="state-card"><LoaderCircle className="spin" size={24} /><span>{label ?? tr("Yuklanmoqda...", "Загрузка...", "Loading...")}</span></div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const { tr } = usePreferences();
  return <div className="state-card error-state"><AlertCircle size={24} /><div><strong>{tr("Ma’lumot olinmadi", "Не удалось получить данные", "Could not load data")}</strong><p>{message}</p></div>{retry && <button className="btn secondary small" onClick={retry}>{tr("Qayta urinish", "Повторить", "Retry")}</button>}</div>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Inbox size={24} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const { tr } = usePreferences();
  const normalized = status.toLowerCase();
  const good = ["connected", "active", "sent", "succeeded", "completed", "received", "open", "owner", "manager"].includes(normalized);
  const bad = ["disconnected", "failed", "delivery_state_unknown"].includes(normalized);
  const labels: Record<string, string> = {
    connected: tr("ulangan", "подключён", "connected"), active: tr("faol", "активен", "active"), sent: tr("yuborilgan", "отправлено", "sent"),
    succeeded: tr("muvaffaqiyatli", "успешно", "succeeded"), completed: tr("bajarilgan", "выполнено", "completed"), received: tr("qabul qilingan", "получено", "received"),
    open: tr("ochiq", "открыто", "open"), disconnected: tr("uzilgan", "отключён", "disconnected"), failed: tr("xato", "ошибка", "failed"),
    delivery_state_unknown: tr("yetkazish noma’lum", "доставка неизвестна", "delivery unknown"), warning: tr("ogohlantirish", "предупреждение", "warning"),
    pending: tr("kutilmoqda", "ожидается", "pending"), paused: tr("to‘xtatilgan", "приостановлен", "paused"), operator: tr("operator", "оператор", "operator"),
    customer: tr("mijoz", "клиент", "customer"), owner: tr("egasi", "владелец", "owner"), manager: tr("menejer", "менеджер", "manager"),
  };
  return <span className={`status-pill ${good ? "good" : bad ? "bad" : "warn"}`}><span />{labels[normalized] ?? status}</span>;
}
