"use client";

import { AlertTriangle, Check, Instagram, Link2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { roleAtLeast, useSession } from "@/components/session-context";
import { usePreferences } from "@/components/preferences-provider";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import type { InstagramAccount } from "@/lib/types";

type AccountResponse = {
  items: InstagramAccount[];
  provider: string;
  login_mode: string;
  meta_configured: boolean;
};

function AccountsContent() {
  const { tr } = usePreferences();
  const session = useSession();
  const canManage = roleAtLeast(session.user.role, "manager");
  const searchParams = useSearchParams();
  const accounts = useApi<AccountResponse>("/instagram/accounts");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const oauthErrors: Record<string, string> = {
    invalid_state: tr("OAuth state eskirgan yoki ishlatilgan. Ulanishni qayta boshlang.", "Состояние OAuth устарело или уже использовано. Начните подключение заново.", "OAuth state expired or was already used. Start the connection again."),
    oauth_exchange_failed: tr("Meta avtorizatsiyasi yakunlanmadi. Konfiguratsiya va ruxsatlarni tekshiring.", "Авторизация Meta не завершена. Проверьте конфигурацию и разрешения.", "Meta authorization did not complete. Check configuration and permissions."),
    token_storage_failed: tr("Access token xavfsiz saqlanmadi; akkaunt ulanmagan.", "Access token не сохранён; аккаунт не подключён.", "The access token was not stored; the account is not connected."),
    account_already_connected: tr("Bu Instagram akkaunt boshqa workspace’ga ulangan.", "Этот Instagram аккаунт подключён к другому workspace.", "This Instagram account is connected to another workspace."),
    account_save_failed: tr("Instagram akkauntini saqlashda xato yuz berdi.", "Не удалось сохранить Instagram аккаунт.", "Could not save the Instagram account."),
  };
  const callbackError = searchParams.get("error");
  const callbackNotice = callbackError
    ? (oauthErrors[callbackError] ?? tr("Meta OAuth ulanishi bekor qilindi.", "Подключение Meta OAuth отменено.", "Meta OAuth connection was cancelled."))
    : searchParams.has("connected") ? tr("Instagram akkaunti muvaffaqiyatli ulandi.", "Instagram аккаунт успешно подключён.", "Instagram account connected successfully.") : "";

  async function connect() {
    if (!canManage || !accounts.data?.meta_configured) return;
    setBusy("connect");
    setNotice("");
    try {
      const result = await api<{ authorization_url: string }>("/instagram/connect");
      window.location.assign(result.authorization_url);
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : tr("Ulash boshlanmadi", "Не удалось начать подключение", "Could not start connection"));
      setBusy("");
    }
  }

  async function disconnect(account: InstagramAccount) {
    if (!canManage || !window.confirm(tr(`@${account.username} akkauntini uzasizmi? Faol qoidalar ishlamay qoladi.`, `Отключить @${account.username}? Активные правила перестанут работать.`, `Disconnect @${account.username}? Active rules will stop working.`))) return;
    setBusy(account.id);
    setNotice("");
    try {
      await api(`/instagram/accounts/${account.id}`, { method: "DELETE" });
      await accounts.reload();
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : tr("Akkaunt uzilmadi", "Не удалось отключить аккаунт", "Could not disconnect account"));
    } finally {
      setBusy("");
    }
  }

  if (accounts.loading) return <LoadingState label={tr("Akkauntlar yuklanmoqda...", "Аккаунты загружаются...", "Loading accounts...")}/>;
  if (accounts.error) return <ErrorState message={accounts.error} retry={accounts.reload}/>;
  const data = accounts.data;
  const items = data?.items ?? [];
  const providerLabel = data?.provider === "meta" && data.login_mode === "unified" ? "Meta · Unified Login" : data?.provider;

  return <>
    <PageHeader
      eyebrow={tr("Integratsiyalar", "Интеграции", "Integrations")}
      title={tr("Instagram akkauntlar", "Аккаунты Instagram", "Instagram accounts")}
      description={tr("Professional Business yoki Creator akkauntlarini rasmiy OAuth orqali ulang.", "Подключайте Professional Business или Creator аккаунты через официальный OAuth.", "Connect Professional Business or Creator accounts through official OAuth.")}
      action={canManage ? <button className="btn primary" onClick={() => void connect()} disabled={busy === "connect" || !data?.meta_configured}><Plus/>{busy === "connect" ? tr("Ulanmoqda...", "Подключение...", "Connecting...") : tr("Akkaunt ulash", "Подключить аккаунт", "Connect account")}</button> : undefined}
    />
    {data && !data.meta_configured && <div className="notice-banner warning"><AlertTriangle/><div><strong>{tr("Meta integratsiyasi sozlanmagan", "Интеграция Meta не настроена", "Meta integration is not configured")}</strong><p>{tr("Serverga Meta credentials kiritilmaguncha akkaunt ulash bloklangan.", "Подключение заблокировано до добавления Meta credentials на сервер.", "Account connection is blocked until Meta credentials are configured on the server.")}</p></div></div>}
    {data?.login_mode === "unified" && <div className="notice-banner warning"><AlertTriangle/><div><strong>{tr("Follow verification cheklovi", "Ограничение проверки подписки", "Follow verification limitation")}</strong><p>{tr("Unified/Facebook login yo‘lida follow tekshiruvi tasdiqlanmagan; natija UNKNOWN fallbackga tushadi.", "Для Unified/Facebook Login проверка подписки не подтверждена; результат будет UNKNOWN.", "Follow verification is not confirmed for Unified/Facebook Login; the result falls back to UNKNOWN.")}</p></div></div>}
    {!canManage && <div className="notice-banner warning"><ShieldCheck/><span>{tr("Akkauntni boshqarish uchun Manager yoki Owner roli kerak.", "Для управления аккаунтами нужна роль Manager или Owner.", "Manager or Owner role is required to manage accounts.")}</span></div>}
    {(notice || callbackNotice) && <div className={`notice-banner ${callbackError || notice ? "warning" : ""}`}><AlertTriangle/><span>{notice || callbackNotice}</span></div>}
    <div className="integration-summary">
      <div><span className="summary-icon"><Link2/></span><div><strong>{tr(`${items.filter((item) => item.status === "connected").length} ta ulangan`, `${items.filter((item) => item.status === "connected").length} подключено`, `${items.filter((item) => item.status === "connected").length} connected`)}</strong><p>Provider: {providerLabel}</p></div></div>
      <div className="security-note"><ShieldCheck/><span>{tr("Access tokenlar shifrlangan va UI’da ko‘rsatilmaydi", "Access token зашифрованы и не показываются в UI", "Access tokens are encrypted and never shown in the UI")}</span></div>
    </div>
    {items.length === 0 ? <EmptyState
      title={tr("Instagram akkaunt ulanmagan", "Instagram аккаунт не подключён", "No Instagram account connected")}
      text={!canManage ? tr("Manager yoki Owner akkaunt ulashi mumkin.", "Аккаунт может подключить Manager или Owner.", "A Manager or Owner can connect an account.") : data?.login_mode === "unified" ? tr("Meta Unified Login orqali Professional akkauntni tanlang.", "Выберите Professional аккаунт через Meta Unified Login.", "Select a Professional account through Meta Unified Login.") : tr("Instagram Login orqali Professional akkauntni ulang.", "Подключите Professional аккаунт через Instagram Login.", "Connect a Professional account through Instagram Login.")}
      action={canManage ? <button className="btn primary" onClick={() => void connect()} disabled={!data?.meta_configured}><Instagram/>{tr("Akkaunt ulash", "Подключить аккаунт", "Connect account")}</button> : undefined}
    /> : <div className="account-grid">{items.map((account) => <article className="account-card" key={account.id}>
      <div className="account-card-top"><span className="account-avatar large"><Instagram/></span><div><h3>@{account.username}</h3><p>{account.account_type}</p></div><StatusPill status={account.status}/></div>
      <div className="account-details"><div><span>Provider</span><strong>{account.provider}</strong></div><div><span>{tr("Oxirgi sync", "Последняя синхронизация", "Last sync")}</span><strong>{account.last_sync_at ? timeAgo(account.last_sync_at) : "—"}</strong></div><div><span>{tr("Token muddati", "Срок токена", "Token expiry")}</span><strong>{formatDate(account.token_expires_at)}</strong></div></div>
      <div className="scope-list"><span>{tr("Ruxsatlar", "Разрешения", "Permissions")}</span>{account.scopes.length ? account.scopes.map((scope) => <small key={scope}><Check/>{scope.replace("instagram_business_", "").replace("instagram_", "")}</small>) : <small>{tr("Meta grant ro‘yxati qaytmadi", "Meta не вернула список разрешений", "Meta did not return the grant list")}</small>}</div>
      {canManage && <div className="account-card-actions"><button className="btn secondary small" onClick={() => void connect()} disabled={Boolean(busy) || !data?.meta_configured}><RefreshCw/>{tr("Qayta ulash", "Переподключить", "Reconnect")}</button><button className="btn danger ghost small" onClick={() => void disconnect(account)} disabled={Boolean(busy)}><Trash2/>{tr("Uzish", "Отключить", "Disconnect")}</button></div>}
    </article>)}</div>}
  </>;
}

export default function AccountsPage() {
  return <Suspense><AccountsContent/></Suspense>;
}
