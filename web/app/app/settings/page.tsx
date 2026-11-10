"use client";

import { Activity, CheckCircle2, Copy, Database, KeyRound, Save, Shield, Trash2, Webhook } from "lucide-react";
import { FormEvent, useState } from "react";
import { ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";

type Settings = {
  profile: {name: string; email: string}; workspace: {id: string; name: string; role: string};
  webhook: {failed_last_24h: number; queued: number}; language: string; notifications_enabled: boolean;
  instagram_provider: string; meta_login_mode: string; meta_configured: boolean; queue_depth: number; webhook_url: string;
};

export default function SettingsPage() {
  const settings = useApi<Settings>("/settings");
  const [form, setForm] = useState<{name: string; workspace_name: string; language: string; notifications_enabled: boolean} | null>(null);
  const [notice, setNotice] = useState("");
  const [deletion, setDeletion] = useState("");
  const currentForm = form ?? {name: settings.data?.profile.name ?? "", workspace_name: settings.data?.workspace.name ?? "", language: settings.data?.language ?? "uz", notifications_enabled: settings.data?.notifications_enabled ?? true};

  async function save(event: FormEvent) { event.preventDefault(); try { const result = await api<{message: string}>("/settings", {method: "PATCH", ...jsonBody(currentForm)}); setNotice(result.message); await settings.reload(); } catch (error) { setNotice(error instanceof ApiError ? error.message : "Sozlamalar saqlanmadi"); } }
  async function requestDeletion() { if (deletion !== "DELETE") return; try { const result = await api<{message: string}>("/settings/data-deletion-request", {method: "POST", ...jsonBody({confirm: deletion})}); setNotice(result.message); setDeletion(""); } catch (error) { setNotice(error instanceof ApiError ? error.message : "So‘rov yaratilmadi"); } }

  if (settings.loading) return <LoadingState label="Sozlamalar yuklanmoqda..."/>;
  if (settings.error || !settings.data) return <ErrorState message={settings.error || "Ma’lumot yo‘q"} retry={settings.reload}/>;
  const data = settings.data;
  const callback = data.webhook_url;

  return <>
    <PageHeader eyebrow="Workspace" title="Sozlamalar" description="Profil, integratsiya diagnostikasi va maxfiylik boshqaruvi."/>
    {notice && <div className="form-alert success">{notice}</div>}
    <div className="settings-layout"><nav className="settings-nav"><a href="#general"><Save/>Umumiy</a><a href="#webhook"><Webhook/>Webhook</a><a href="#security"><Shield/>Xavfsizlik</a><a href="#privacy"><Trash2/>Maxfiylik</a></nav><div className="settings-content">
      <form className="panel form-section" id="general" onSubmit={save}><div className="panel-header"><div><h2>Umumiy sozlamalar</h2><p>Profil va workspace</p></div></div><div className="form-grid"><label><span>Ism</span><input minLength={2} maxLength={80} value={currentForm.name} onChange={(event) => setForm({...currentForm, name: event.target.value})}/></label><label><span>Email</span><input value={data.profile.email} disabled/></label><label><span>Workspace nomi <small>{data.workspace.role === "owner" ? "" : "Faqat Owner"}</small></span><input minLength={2} maxLength={100} value={currentForm.workspace_name} disabled={data.workspace.role !== "owner"} onChange={(event) => setForm({...currentForm, workspace_name: event.target.value})}/></label><label><span>Til</span><select value={currentForm.language} onChange={(event) => setForm({...currentForm, language: event.target.value})}><option value="uz">O‘zbek</option><option value="ru">Русский (scaffold)</option><option value="en">English (scaffold)</option></select></label></div><label className="toggle-row" id="notifications"><div><strong>Bildirishnomalar</strong><small>Platforma ichidagi muhim holatlar</small></div><input type="checkbox" checked={currentForm.notifications_enabled} onChange={(event) => setForm({...currentForm, notifications_enabled: event.target.checked})}/></label><button className="btn primary"><Save/>Saqlash</button></form>
      <section className="panel form-section" id="webhook"><div className="panel-header"><div><h2>Webhook diagnostikasi</h2><p>Callback va queue holati</p></div><StatusPill status={data.meta_configured && data.webhook.failed_last_24h === 0 ? "active" : "warning"}/></div><div className="diagnostic-grid"><div><span><Activity/> Queue</span><strong>{data.queue_depth} signal / {data.webhook.queued} persisted</strong></div><div><span><Database/> 24 soatdagi xato</span><strong>{data.webhook.failed_last_24h}</strong></div><div><span><KeyRound/> Provider</span><strong>{data.instagram_provider}{data.instagram_provider === "meta" ? ` · ${data.meta_login_mode} · ${data.meta_configured ? "sozlangan" : "bloklangan"}` : ""}</strong></div></div><label><span>Webhook URL</span><div className="copy-field"><input readOnly value={callback}/><button type="button" aria-label="Webhook URL nusxalash" onClick={() => void navigator.clipboard.writeText(callback)}><Copy/></button></div></label></section>
      <section className="panel form-section" id="security"><div className="panel-header"><div><h2>Xavfsizlik</h2><p>Server-side himoyalar</p></div><Shield/></div><div className="security-list"><span><CheckCircle2/> HttpOnly session cookie va CSRF</span><span><CheckCircle2/> OAuth state bir martalik va 10 daqiqalik</span><span><CheckCircle2/> Instagram token AES-256-GCM bilan shifrlangan</span><span><CheckCircle2/> Webhook HMAC signature tekshiruvi</span></div></section>
      <section className="panel danger-zone" id="privacy"><div><h2>Ma’lumotni o‘chirish so‘rovi</h2><p>Bu amal avtomatik o‘chirmaydi; audit logga manual review sifatida yoziladi.</p></div><div className="danger-action"><input value={deletion} onChange={(event) => setDeletion(event.target.value)} placeholder="DELETE yozing"/><button className="btn danger" onClick={() => void requestDeletion()} disabled={deletion !== "DELETE"}><Trash2/>So‘rov yuborish</button></div></section>
    </div></div>
  </>;
}
