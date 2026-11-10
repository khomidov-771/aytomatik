"use client";

import { Activity, CheckCircle2, Copy, Database, KeyRound, Save, Shield, Trash2, Webhook } from "lucide-react";
import { FormEvent, useState } from "react";
import { Locale, usePreferences } from "@/components/preferences-provider";
import { ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";

type Settings = {
  profile: {name: string; email: string}; workspace: {id: string; name: string; role: string};
  webhook: {failed_last_24h: number; queued: number}; language: string; notifications_enabled: boolean;
  instagram_provider: string; meta_login_mode: string; meta_configured: boolean; queue_depth: number; webhook_url: string;
};

export default function SettingsPage() {
  const { locale, setLocale, tr } = usePreferences();
  const settings = useApi<Settings>("/settings");
  const [form, setForm] = useState<{name: string; workspace_name: string; language: string; notifications_enabled: boolean} | null>(null);
  const [notice, setNotice] = useState("");
  const [deletion, setDeletion] = useState("");
  const currentForm = form ?? {name: settings.data?.profile.name ?? "", workspace_name: settings.data?.workspace.name ?? "", language: settings.data?.language ?? locale, notifications_enabled: settings.data?.notifications_enabled ?? true};

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{message: string}>("/settings", {method: "PATCH", ...jsonBody(currentForm)});
      setLocale(currentForm.language as Locale);
      setNotice(result.message);
      await settings.reload();
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : tr("Sozlamalar saqlanmadi", "Настройки не сохранены", "Settings were not saved"));
    }
  }

  async function requestDeletion() {
    if (deletion !== "DELETE") return;
    try {
      const result = await api<{message: string}>("/settings/data-deletion-request", {method: "POST", ...jsonBody({confirm: deletion})});
      setNotice(result.message);
      setDeletion("");
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : tr("So‘rov yaratilmadi", "Запрос не создан", "Request was not created"));
    }
  }

  if (settings.loading) return <LoadingState label={tr("Sozlamalar yuklanmoqda...", "Настройки загружаются...", "Loading settings...")}/>;
  if (settings.error || !settings.data) return <ErrorState message={settings.error || tr("Ma’lumot yo‘q", "Нет данных", "No data")} retry={settings.reload}/>;
  const data = settings.data;

  return <>
    <PageHeader eyebrow="Workspace" title={tr("Sozlamalar", "Настройки", "Settings")} description={tr("Profil, integratsiya diagnostikasi va maxfiylik boshqaruvi.", "Профиль, диагностика интеграции и управление конфиденциальностью.", "Profile, integration diagnostics, and privacy controls.")}/>
    {notice && <div className="form-alert success">{notice}</div>}
    <div className="settings-layout"><nav className="settings-nav"><a href="#general"><Save/>{tr("Umumiy", "Общие", "General")}</a><a href="#webhook"><Webhook/>Webhook</a><a href="#security"><Shield/>{tr("Xavfsizlik", "Безопасность", "Security")}</a><a href="#privacy"><Trash2/>{tr("Maxfiylik", "Конфиденциальность", "Privacy")}</a></nav><div className="settings-content">
      <form className="panel form-section" id="general" onSubmit={save}>
        <div className="panel-header"><div><h2>{tr("Umumiy sozlamalar", "Общие настройки", "General settings")}</h2><p>{tr("Profil va workspace", "Профиль и workspace", "Profile and workspace")}</p></div></div>
        <div className="form-grid"><label><span>{tr("Ism", "Имя", "Name")}</span><input minLength={2} maxLength={80} value={currentForm.name} onChange={(event) => setForm({...currentForm, name: event.target.value})}/></label><label><span>Email</span><input value={data.profile.email} disabled/></label><label><span>{tr("Workspace nomi", "Название workspace", "Workspace name")} <small>{data.workspace.role === "owner" ? "" : tr("Faqat Owner", "Только Owner", "Owner only")}</small></span><input minLength={2} maxLength={100} value={currentForm.workspace_name} disabled={data.workspace.role !== "owner"} onChange={(event) => setForm({...currentForm, workspace_name: event.target.value})}/></label><label><span>{tr("Til", "Язык", "Language")}</span><select value={currentForm.language} onChange={(event) => { const language = event.target.value as Locale; setForm({...currentForm, language}); setLocale(language); }}><option value="uz">O‘zbek</option><option value="ru">Русский</option><option value="en">English</option></select></label></div>
        <label className="toggle-row" id="notifications"><div><strong>{tr("Bildirishnomalar", "Уведомления", "Notifications")}</strong><small>{tr("Platformadagi muhim holatlar", "Важные события платформы", "Important platform events")}</small></div><input type="checkbox" checked={currentForm.notifications_enabled} onChange={(event) => setForm({...currentForm, notifications_enabled: event.target.checked})}/></label><button className="btn primary"><Save/>{tr("Saqlash", "Сохранить", "Save")}</button>
      </form>
      <section className="panel form-section" id="webhook"><div className="panel-header"><div><h2>{tr("Webhook diagnostikasi", "Диагностика webhook", "Webhook diagnostics")}</h2><p>{tr("Callback va navbat holati", "Состояние callback и очереди", "Callback and queue status")}</p></div><StatusPill status={data.meta_configured && data.webhook.failed_last_24h === 0 ? "active" : "warning"}/></div><div className="diagnostic-grid"><div><span><Activity/> Queue</span><strong>{data.queue_depth} signal / {data.webhook.queued} persisted</strong></div><div><span><Database/> {tr("24 soatdagi xato", "Ошибок за 24 часа", "Failures in 24 hours")}</span><strong>{data.webhook.failed_last_24h}</strong></div><div><span><KeyRound/> Provider</span><strong>{data.instagram_provider}{data.instagram_provider === "meta" ? ` · ${data.meta_login_mode} · ${data.meta_configured ? tr("sozlangan", "настроено", "configured") : tr("bloklangan", "заблокировано", "blocked")}` : ""}</strong></div></div><label><span>Webhook URL</span><div className="copy-field"><input readOnly value={data.webhook_url}/><button type="button" aria-label={tr("Webhook URL nusxalash", "Копировать Webhook URL", "Copy webhook URL")} onClick={() => void navigator.clipboard.writeText(data.webhook_url)}><Copy/></button></div></label></section>
      <section className="panel form-section" id="security"><div className="panel-header"><div><h2>{tr("Xavfsizlik", "Безопасность", "Security")}</h2><p>{tr("Server himoyalari", "Серверная защита", "Server-side protections")}</p></div><Shield/></div><div className="security-list"><span><CheckCircle2/> {tr("HttpOnly sessiya cookie va CSRF", "HttpOnly session cookie и CSRF", "HttpOnly session cookie and CSRF")}</span><span><CheckCircle2/> {tr("OAuth state bir martalik va 10 daqiqalik", "Одноразовый OAuth state на 10 минут", "Single-use OAuth state valid for 10 minutes")}</span><span><CheckCircle2/> {tr("Instagram token AES-256-GCM bilan shifrlangan", "Instagram token зашифрован AES-256-GCM", "Instagram token encrypted with AES-256-GCM")}</span><span><CheckCircle2/> {tr("Webhook HMAC imzosi tekshiriladi", "Проверяется HMAC-подпись webhook", "Webhook HMAC signature is verified")}</span></div></section>
      <section className="panel danger-zone" id="privacy"><div><h2>{tr("Ma’lumotni o‘chirish so‘rovi", "Запрос на удаление данных", "Data deletion request")}</h2><p>{tr("Bu amal avtomatik o‘chirmaydi; audit jurnaliga qo‘lda ko‘rib chiqish uchun yoziladi.", "Данные не удаляются автоматически; запрос записывается в аудит для ручной проверки.", "This does not delete automatically; it records a manual-review request in the audit log.")}</p></div><div className="danger-action"><input value={deletion} onChange={(event) => setDeletion(event.target.value)} placeholder={tr("DELETE yozing", "Введите DELETE", "Type DELETE")}/><button type="button" className="btn danger" onClick={() => void requestDeletion()} disabled={deletion !== "DELETE"}><Trash2/>{tr("So‘rov yuborish", "Отправить запрос", "Submit request")}</button></div></section>
    </div></div>
  </>;
}
