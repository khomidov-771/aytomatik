"use client";

import { ArrowUpRight, ChevronDown, Copy, SlidersHorizontal, Shield, Trash2, Webhook } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Locale, usePreferences } from "@/components/preferences-provider";
import { SelectMenu } from "@/components/select-menu";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";

type Settings = {
  profile: {name: string; email: string; login_provider?: "email" | "google" | "instagram"}; workspace: {id: string; name: string; role: string};
  webhook: {failed_last_24h: number; queued: number}; language: string; notifications_enabled: boolean;
  instagram_provider: string; meta_login_mode: string; meta_configured: boolean; queue_depth: number; webhook_url: string;
};

export default function SettingsPage() {
  const { locale, setLocale, tr } = usePreferences();
  const settings = useApi<Settings>("/settings");
  const [form, setForm] = useState<{name: string; workspace_name: string; language: string; notifications_enabled: boolean} | null>(null);
  const [notice, setNotice] = useState("");
  const [failed,setFailed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState<"general"|"access">("general");
  const [deletion, setDeletion] = useState("");
  const currentForm = form ?? {name: settings.data?.profile.name ?? "", workspace_name: settings.data?.workspace.name ?? "", language: settings.data?.language ?? locale, notifications_enabled: settings.data?.notifications_enabled ?? true};

  async function save(event: FormEvent) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);setNotice("");setFailed(false);
    try {
      await api<{message: string}>("/settings", {method: "PATCH", ...jsonBody(currentForm)});
      setLocale(currentForm.language as Locale);
      setNotice(tr("Sozlamalar saqlandi.","Настройки сохранены.","Settings saved."));
      setForm(null);
      await settings.reload();
    } catch (error) {
      setFailed(true);setNotice(error instanceof ApiError ? error.message : tr("Sozlamalar saqlanmadi", "Настройки не сохранены", "Settings were not saved"));
    } finally {setBusy(false);}
  }

  async function requestDeletion() {
    if (deletion !== "DELETE" || busy) return;
    setBusy(true);setFailed(false);setNotice("");
    try {
      await api<{message: string}>("/settings/data-deletion-request", {method: "POST", ...jsonBody({confirm: deletion})});
      setNotice(tr("So‘rov ko‘rib chiqish uchun yuborildi.","Запрос отправлен на рассмотрение.","Request submitted for review."));
      setDeletion("");
    } catch (error) {
      setFailed(true);setNotice(error instanceof ApiError ? error.message : tr("So‘rov yaratilmadi", "Запрос не создан", "Request was not created"));
    } finally {setBusy(false);}
  }

  if (settings.loading) return <LoadingState label={tr("Sozlamalar yuklanmoqda...", "Настройки загружаются...", "Loading settings...")}/>;
  if (settings.error || !settings.data) return <ErrorState message={settings.error || tr("Ma’lumot yo‘q", "Нет данных", "No data")} retry={settings.reload}/>;
  const data = settings.data;

  const isOwner=data.workspace.role==="owner";
  const isManager=isOwner || data.workspace.role==="manager";
  return <div className="preferences-page">
    <PageHeader title={tr("Sozlamalar","Настройки","Settings")}/>
    <div className="preferences-tabs" aria-label={tr("Bo‘limlar","Разделы","Sections")}>
      <button type="button" aria-pressed={tab==="general"} onClick={()=>{setTab("general");setNotice("")}}><SlidersHorizontal/>{tr("Umumiy","Общие","General")}</button>
      <button type="button" aria-pressed={tab==="access"} onClick={()=>{setTab("access");setNotice("")}}><Shield/>{tr("Xavfsizlik va maxfiylik","Безопасность и данные","Security and privacy")}</button>
    </div>
    {notice && <p role={failed?"alert":"status"} className={"form-alert "+(failed?"error":"success")}>{notice}</p>}
    {tab==="general" ? <>
      <form className="preferences-card" onSubmit={save}>
        <h2>{tr("Profil va ish maydoni","Профиль и рабочее пространство","Profile and workspace")}</h2>
        <div className="preferences-fields">
          <label><span>{tr("Ismingiz","Ваше имя","Your name")}</span><input autoComplete="name" required minLength={2} maxLength={80} value={currentForm.name} onChange={e=>setForm({...currentForm,name:e.target.value})}/></label>
          <div className="preferences-readonly"><span>{data.profile.email?"Email":tr("Kirish usuli","Способ входа","Sign-in method")}</span><strong>{data.profile.email || (data.profile.login_provider==="google"?"Google":"Instagram")}</strong></div>
          <label><span>{tr("Ish maydoni nomi","Название пространства","Workspace name")}</span><input required minLength={2} maxLength={100} value={currentForm.workspace_name} readOnly={!isOwner} onChange={e=>setForm({...currentForm,workspace_name:e.target.value})}/></label>
          <div className="preferences-language"><span>{tr("Til","Язык","Language")}</span><SelectMenu ariaLabel={tr("Til","Язык","Language")} value={currentForm.language} onChange={language=>setForm({...currentForm,language})} options={[{value:"uz",label:"O‘zbekcha"},{value:"ru",label:"Русский"},{value:"en",label:"English"}]}/></div>
        </div>
        <label className="preference-toggle" id="notifications"><span>{tr("Bildirishnomalar","Уведомления","Notifications")}</span>
          <input type="checkbox" role="switch" checked={currentForm.notifications_enabled} onChange={e=>setForm({...currentForm,notifications_enabled:e.target.checked})}/><i aria-hidden="true"/></label>
        <footer><button type="submit" className="btn primary" disabled={busy || !form}>{tr("Saqlash","Сохранить","Save changes")}</button></footer>
      </form>
      {isManager && <details className="preferences-card integration-details"><summary><Webhook/>{tr("Integratsiya holati","Состояние интеграции","Integration status")}<ChevronDown/></summary>
        <dl><div><dt>{tr("Navbatdagi izohlar","Комментарии в очереди","Queued comments")}</dt><dd>{data.webhook.queued}</dd></div>
          <div><dt>{tr("Oxirgi 24 soatdagi xatolar","Ошибки за 24 часа","Failures in the last 24 hours")}</dt><dd>{data.webhook.failed_last_24h}</dd></div>
          <div><dt>Meta API</dt><dd>{data.meta_configured?tr("Sozlangan","Настроено","Configured"):tr("Sozlash kerak","Требуется настройка","Setup required")}</dd></div></dl>
        <div className="preferences-url"><code>{data.webhook_url}</code><button type="button" className="kg-icon" aria-label={tr("Manzilni nusxalash","Скопировать адрес","Copy URL")} onClick={async()=>{try{await navigator.clipboard.writeText(data.webhook_url);setFailed(false);setNotice(tr("Manzil nusxalandi.","Адрес скопирован.","URL copied."))}catch{setFailed(true);setNotice(tr("Manzilni belgilab nusxalang.","Выделите и скопируйте адрес.","Select and copy the URL."))}}}><Copy/></button></div>
      </details>}
    </> : <div className="preferences-card"><h2>{tr("Hisobga kirish","Доступ к аккаунту","Account access")}</h2>
      <Link className="preferences-link" href="/app/profile">{tr("Faol sessiyalarni boshqarish","Управление сеансами","Manage active sessions")}<ArrowUpRight/></Link>
      {isOwner && <details className="preferences-privacy"><summary><Trash2/>{tr("Ma’lumotlarni o‘chirish so‘rovi","Запрос на удаление данных","Request data deletion")}<ChevronDown/></summary>
        <p>{tr("So‘rovni ko‘rib chiqishga yuborish uchun DELETE yozing.","Введите DELETE, чтобы отправить запрос на рассмотрение.","Type DELETE to submit a request for review.")}</p>
        <label><span className="sr-only">{tr("Tasdiqlash","Подтверждение","Confirmation")}</span><input value={deletion} placeholder="DELETE" onChange={e=>setDeletion(e.target.value)}/></label>
        <button type="button" className="btn danger" disabled={deletion!=="DELETE"||busy} onClick={()=>void requestDeletion()}>{tr("So‘rov yuborish","Отправить запрос","Submit request")}</button>
      </details>}
    </div>}
  </div>;
}
