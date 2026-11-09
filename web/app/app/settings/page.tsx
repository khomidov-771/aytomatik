"use client";

import { Activity, CheckCircle2, Copy, Database, KeyRound, Save, Send, Shield, Trash2, Webhook } from "lucide-react";
import { FormEvent, useState } from "react";
import { DemoBadge, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { InstagramAccount, Plan } from "@/lib/types";

type Settings = {
  profile: {name: string; email: string}; workspace: {id: string; name: string; role: string}; plan: Plan;
  webhook: {failed_last_24h: number; queued: number}; language: string; notifications_enabled: boolean;
  instagram_provider: string; meta_login_mode: string; demo_mode: boolean; queue_depth: number; webhook_url: string;
};

export default function SettingsPage() {
  const settings = useApi<Settings>("/settings");
  const accounts = useApi<{items: InstagramAccount[]}>("/instagram/accounts");
  const [form, setForm] = useState<{name: string; workspace_name: string; language: string; notifications_enabled: boolean} | null>(null);
  const [notice, setNotice] = useState("");
  const [deletion, setDeletion] = useState("");
  const [mock, setMock] = useState({account_id: "", comment_id: "demo-comment-001", media_id: "demo-media-001", text: "Narxi qancha?", username: "aziza", participant_id: "demo-user-001"});
  const currentForm = form ?? {name: settings.data?.profile.name ?? "", workspace_name: settings.data?.workspace.name ?? "", language: settings.data?.language ?? "uz", notifications_enabled: settings.data?.notifications_enabled ?? true};
  const mockAccountID = mock.account_id || accounts.data?.items[0]?.instagram_user_id || "";

  async function save(event: FormEvent) { event.preventDefault(); try { const result = await api<{message: string}>("/settings", {method: "PATCH", ...jsonBody(currentForm)}); setNotice(result.message); await settings.reload(); } catch (error) { setNotice(error instanceof ApiError ? error.message : "Sozlamalar saqlanmadi"); } }
  async function testWebhook(event: FormEvent) { event.preventDefault(); try { const result = await api<{status: string; event_id?: string; demo_mode: boolean}>("/webhooks/instagram/mock-event", {method: "POST", ...jsonBody({...mock, account_id: mockAccountID, provider_event_id: `mock:${mock.comment_id}`})}); setNotice(`Mock event: ${result.status}. Inbox va analyticsni bir necha soniyadan keyin tekshiring.`); } catch (error) { setNotice(error instanceof ApiError ? error.message : "Mock event yuborilmadi"); } }
  async function requestDeletion() { if (deletion !== "DELETE") return; try { const result = await api<{message: string}>("/settings/data-deletion-request", {method: "POST", ...jsonBody({confirm: deletion})}); setNotice(result.message); setDeletion(""); } catch (error) { setNotice(error instanceof ApiError ? error.message : "So‘rov yaratilmadi"); } }

  if (settings.loading) return <LoadingState label="Sozlamalar yuklanmoqda..."/>;
  if (settings.error || !settings.data) return <ErrorState message={settings.error || "Ma’lumot yo‘q"} retry={settings.reload}/>;
  const data = settings.data;
  const callback = data.webhook_url;

  return <>
    <PageHeader eyebrow="Workspace" title="Sozlamalar" description="Profil, integratsiya diagnostikasi va maxfiylik boshqaruvi." action={<DemoBadge show={data.demo_mode}/>}/>
    {notice && <div className="form-alert success">{notice}</div>}
    <div className="settings-layout"><nav className="settings-nav"><a href="#general"><Save/>Umumiy</a><a href="#webhook"><Webhook/>Webhook</a><a href="#security"><Shield/>Xavfsizlik</a><a href="#privacy"><Trash2/>Maxfiylik</a></nav><div className="settings-content">
      <form className="panel form-section" id="general" onSubmit={save}><div className="panel-header"><div><h2>Umumiy sozlamalar</h2><p>Profil va workspace</p></div></div><div className="form-grid"><label><span>Ism</span><input minLength={2} maxLength={80} value={currentForm.name} onChange={(event) => setForm({...currentForm, name: event.target.value})}/></label><label><span>Email</span><input value={data.profile.email} disabled/></label><label><span>Workspace nomi <small>{data.workspace.role === "owner" ? "" : "Faqat Owner"}</small></span><input minLength={2} maxLength={100} value={currentForm.workspace_name} disabled={data.workspace.role !== "owner"} onChange={(event) => setForm({...currentForm, workspace_name: event.target.value})}/></label><label><span>Til</span><select value={currentForm.language} onChange={(event) => setForm({...currentForm, language: event.target.value})}><option value="uz">O‘zbek</option><option value="ru">Русский (scaffold)</option><option value="en">English (scaffold)</option></select></label></div><label className="toggle-row" id="notifications"><div><strong>Bildirishnomalar</strong><small>Platforma ichidagi muhim holatlar</small></div><input type="checkbox" checked={currentForm.notifications_enabled} onChange={(event) => setForm({...currentForm, notifications_enabled: event.target.checked})}/></label><button className="btn primary"><Save/>Saqlash</button></form>
      <section className="panel form-section" id="webhook"><div className="panel-header"><div><h2>Webhook diagnostikasi</h2><p>Callback va queue holati</p></div><StatusPill status={data.webhook.failed_last_24h === 0 ? "active" : "warning"}/></div><div className="diagnostic-grid"><div><span><Activity/> Queue</span><strong>{data.queue_depth} signal / {data.webhook.queued} persisted</strong></div><div><span><Database/> 24 soatdagi xato</span><strong>{data.webhook.failed_last_24h}</strong></div><div><span><KeyRound/> Provider</span><strong>{data.instagram_provider}{data.instagram_provider === "meta" ? ` · ${data.meta_login_mode}` : ""}</strong></div></div><label><span>Webhook URL</span><div className="copy-field"><input readOnly value={callback}/><button type="button" aria-label="Webhook URL nusxalash" onClick={() => void navigator.clipboard.writeText(callback)}><Copy/></button></div></label>{data.demo_mode && <form className="mock-tester" onSubmit={testWebhook}><div className="form-section-title"><span><Send/></span><div><h3>Mock comment event</h3><p>Idempotency: bir xil comment ID ikkinchi marta ishlanmaydi.</p></div></div><label><span>Akkaunt</span><select value={mockAccountID} onChange={(event) => setMock({...mock, account_id: event.target.value})}>{accounts.data?.items.map((item) => <option key={item.id} value={item.instagram_user_id}>@{item.username}</option>)}</select></label><div className="form-grid"><label><span>Comment ID</span><input maxLength={128} value={mock.comment_id} onChange={(event) => setMock({...mock, comment_id: event.target.value})}/></label><label><span>Comment matni</span><input maxLength={1000} value={mock.text} onChange={(event) => setMock({...mock, text: event.target.value})}/></label></div><button className="btn secondary"><Send/>Mock event yuborish</button></form>}</section>
      <section className="panel form-section" id="security"><div className="panel-header"><div><h2>Xavfsizlik</h2><p>Server-side himoyalar</p></div><Shield/></div><div className="security-list"><span><CheckCircle2/> HttpOnly session cookie va CSRF</span><span><CheckCircle2/> OAuth state bir martalik va 10 daqiqalik</span><span><CheckCircle2/> Instagram token AES-256-GCM bilan shifrlangan</span><span><CheckCircle2/> Webhook HMAC signature tekshiruvi</span></div></section>
      <section className="panel danger-zone" id="privacy"><div><h2>Ma’lumotni o‘chirish so‘rovi</h2><p>Bu amal avtomatik o‘chirmaydi; audit logga manual review sifatida yoziladi.</p></div><div className="danger-action"><input value={deletion} onChange={(event) => setDeletion(event.target.value)} placeholder="DELETE yozing"/><button className="btn danger" onClick={() => void requestDeletion()} disabled={deletion !== "DELETE"}><Trash2/>So‘rov yuborish</button></div></section>
    </div></div>
  </>;
}
