"use client";

import { AlertTriangle, BadgeCheck, Check, Instagram, Link2, LockKeyhole, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
    oauth_token_exchange_failed: tr("Meta ruxsat kodini token bilan almashtirmadi. Ulanishni qayta boshlang; takrorlansa Meta App ID/Secret va callback manzili aynan mosligini tekshiring.", "Meta не обменяла код разрешения на токен. Начните подключение заново; если ошибка повторится, проверьте Meta App ID/Secret и точное совпадение callback URL.", "Meta did not exchange the authorization code for a token. Restart the connection; if it repeats, verify the Meta App ID/Secret and exact callback URL."),
    instagram_asset_access_failed: tr("Meta akkauntlar ro‘yxatini bera olmadi. Unified Login konfiguratsiyasida Instagram Professional asset va kerakli ruxsatlar borligini tekshiring.", "Meta не вернула список аккаунтов. Проверьте Instagram Professional asset и разрешения в конфигурации Unified Login.", "Meta could not list Instagram accounts. Check that the Unified Login configuration includes the Professional account asset and required permissions."),
    instagram_asset_not_shared: tr("Meta ruxsatni qabul qildi, ammo akkauntlar API’si 0 ta Instagram akkaunt qaytardi. Instagram profilingiz Business yoki Creator turiga o‘tkazilganini, tanlangan Business Portfolio’da Instagram akkaunt sifatida mavjudligini va aynan shu hisob Meta konfiguratsiyasida ulashish uchun tanlanganini tekshiring. Hozircha akkaunt ham, token ham saqlanmadi.", "Meta приняла разрешение, но API вернул 0 аккаунтов Instagram. Убедитесь, что профиль переведён в тип Business или Creator, добавлен как аккаунт Instagram в выбранный Business Portfolio и выбран в конфигурации Meta для передачи приложению. Аккаунт и токен не сохранены.", "Meta accepted the permission, but its account API returned 0 Instagram accounts. Check that the profile is a Business or Creator account, is present in the selected Business Portfolio as an Instagram account, and is selected for sharing in the Meta configuration. No account or token was saved."),
    multiple_instagram_assets: tr("Meta bir nechta Instagram akkauntini qaytardi. Meta konfiguratsiyasida bitta kerakli Professional akkauntni tanlang.", "Meta вернула несколько Instagram аккаунтов. Выберите один нужный Professional аккаунт в конфигурации Meta.", "Meta returned multiple Instagram accounts. Select one intended Professional account in the Meta configuration."),
    webhook_subscription_failed: tr("Akkaunt topildi, ammo webhook obunasi tasdiqlanmadi. Meta App’dagi comments/messages ruxsatlarini tekshiring va qayta ulang.", "Аккаунт найден, но подписка webhook не подтверждена. Проверьте разрешения comments/messages в Meta App и подключите повторно.", "The account was found, but Meta did not confirm the webhook subscription. Check comments/messages permissions in the Meta App and reconnect."),
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
  const recentlyConnectedAccount = searchParams.has("connected") ? items.find((item) => item.status === "connected") : undefined;
  const providerLabel = data?.provider === "meta" ? (data.login_mode === "unified" ? "Meta · Unified Login" : "Instagram Login") : data?.provider;

  return <>
    <PageHeader
      eyebrow={tr("Integratsiyalar", "Интеграции", "Integrations")}
      title={tr("Instagram bilan kirish", "Вход через Instagram", "Connect with Instagram")}
      description={tr("O‘z Professional Business yoki Creator akkauntingizni rasmiy Instagram/Meta oynasi orqali ulang.", "Подключите свой Professional Business или Creator аккаунт через официальное окно Instagram/Meta.", "Connect your own Professional Business or Creator account through the official Instagram/Meta window.")}
      action={canManage ? <button className="btn primary" onClick={() => void connect()} disabled={busy === "connect" || !data?.meta_configured}><Instagram/>{busy === "connect" ? tr("Instagram ochilmoqda...", "Открываем Instagram...", "Opening Instagram...") : tr("Instagram bilan kirish", "Войти через Instagram", "Continue with Instagram")}</button> : undefined}
    />
    {data && !data.meta_configured && <div className="notice-banner warning"><AlertTriangle/><div><strong>{tr("Meta integratsiyasi sozlanmagan", "Интеграция Meta не настроена", "Meta integration is not configured")}</strong><p>{tr("Serverga Meta credentials kiritilmaguncha akkaunt ulash bloklangan.", "Подключение заблокировано до добавления Meta credentials на сервер.", "Account connection is blocked until Meta credentials are configured on the server.")}</p></div></div>}
    {data?.login_mode === "unified" && <div className="notice-banner warning"><AlertTriangle/><div><strong>{tr("Follow verification cheklovi", "Ограничение проверки подписки", "Follow verification limitation")}</strong><p>{tr("Unified/Facebook login yo‘lida follow tekshiruvi tasdiqlanmagan; natija UNKNOWN fallbackga tushadi.", "Для Unified/Facebook Login проверка подписки не подтверждена; результат будет UNKNOWN.", "Follow verification is not confirmed for Unified/Facebook Login; the result falls back to UNKNOWN.")}</p></div></div>}
    {!canManage && <div className="notice-banner warning"><ShieldCheck/><span>{tr("Akkauntni boshqarish uchun Manager yoki Owner roli kerak.", "Для управления аккаунтами нужна роль Manager или Owner.", "Manager or Owner role is required to manage accounts.")}</span></div>}
    {(notice || callbackNotice) && <div className={`notice-banner ${callbackError || notice ? "warning" : ""}`}><AlertTriangle/><span>{notice || callbackNotice}</span></div>}
    {recentlyConnectedAccount && <div className="setup-continue-banner"><div><BadgeCheck/><span><strong>{tr("Instagram ulandi", "Instagram подключён", "Instagram connected")}</strong><small>{tr("Endi post va avtomatik javoblarni tanlang.", "Теперь выберите публикации и автоматические ответы.", "Now choose posts and automated replies.")}</small></span></div><Link className="btn primary small" href={`/setup?step=2&account=${encodeURIComponent(recentlyConnectedAccount.id)}`}>{tr("Sozlashni davom ettirish", "Продолжить настройку", "Continue setup")} <Check/></Link></div>}
    {items.length === 0 && canManage && <section className="instagram-login-flow panel"><div className="login-flow-copy"><span className="instagram-login-mark"><Instagram/></span><div><h2>{tr("Akkauntingizni xavfsiz ulang", "Безопасно подключите аккаунт", "Connect your account securely")}</h2><p>{tr("Tugmani bosganda rasmiy Instagram yoki Meta login oynasi ochiladi. Login va parol IDS Automate serveriga kelmaydi.", "Откроется официальное окно входа Instagram или Meta. Логин и пароль не передаются на сервер IDS Automate.", "The official Instagram or Meta login window opens. Your login and password never reach IDS Automate.")}</p></div></div><div className="login-flow-steps"><div><span>1</span><strong>{tr("Instagram bilan kiring", "Войдите через Instagram", "Sign in with Instagram")}</strong></div><div><span>2</span><strong>{tr("Professional akkauntni tanlang", "Выберите Professional аккаунт", "Choose a Professional account")}</strong></div><div><span>3</span><strong>{tr("Ruxsatlarni tasdiqlang", "Подтвердите разрешения", "Approve permissions")}</strong></div></div><div className="login-flow-security"><LockKeyhole/><span>{tr("Parol saqlanmaydi", "Пароль не сохраняется", "Password is not stored")}</span><BadgeCheck/><span>{tr("Faqat rasmiy Meta API", "Только официальный Meta API", "Official Meta API only")}</span></div><button className="btn primary" onClick={() => void connect()} disabled={busy === "connect" || !data?.meta_configured}><Instagram/>{busy === "connect" ? tr("Instagram ochilmoqda...", "Открываем Instagram...", "Opening Instagram...") : tr("Instagram bilan davom etish", "Продолжить через Instagram", "Continue with Instagram")}</button></section>}
    <div className="integration-summary">
      <div><span className="summary-icon"><Link2/></span><div><strong>{tr(`${items.filter((item) => item.status === "connected").length} ta ulangan`, `${items.filter((item) => item.status === "connected").length} подключено`, `${items.filter((item) => item.status === "connected").length} connected`)}</strong><p>Provider: {providerLabel}</p></div></div>
      <div className="security-note"><ShieldCheck/><span>{tr("Access tokenlar shifrlangan va UI’da ko‘rsatilmaydi", "Access token зашифрованы и не показываются в UI", "Access tokens are encrypted and never shown in the UI")}</span></div>
    </div>
    {items.length === 0 ? <EmptyState
      title={tr("Instagram akkaunt ulanmagan", "Instagram аккаунт не подключён", "No Instagram account connected")}
      text={!canManage ? tr("Manager yoki Owner akkaunt ulashi mumkin.", "Аккаунт может подключить Manager или Owner.", "A Manager or Owner can connect an account.") : data?.login_mode === "unified" ? tr("Meta Unified Login orqali Professional akkauntni tanlang.", "Выберите Professional аккаунт через Meta Unified Login.", "Select a Professional account through Meta Unified Login.") : tr("Instagram Login orqali Professional akkauntni ulang.", "Подключите Professional аккаунт через Instagram Login.", "Connect a Professional account through Instagram Login.")}
      action={undefined}
    /> : <div className="account-grid">{items.map((account) => <article className="account-card" key={account.id}>
      <div className="account-card-top"><span className="account-avatar large"><Instagram/></span><div><h3>@{account.username}</h3><p>{account.account_type === "UNKNOWN" ? tr("Meta akkaunt turini qaytarmadi", "Meta не вернула тип аккаунта", "Meta did not return the account subtype") : account.account_type}</p></div><StatusPill status={account.status}/></div>
      <div className="account-details"><div><span>Provider</span><strong>{account.provider}</strong></div><div><span>{tr("Oxirgi sync", "Последняя синхронизация", "Last sync")}</span><strong>{account.last_sync_at ? timeAgo(account.last_sync_at) : "—"}</strong></div><div><span>{tr("Token muddati", "Срок токена", "Token expiry")}</span><strong>{formatDate(account.token_expires_at)}</strong></div></div>
      <div className="scope-list"><span>{tr("Ruxsatlar", "Разрешения", "Permissions")}</span>{account.scopes.length ? account.scopes.map((scope) => <small key={scope}><Check/>{scope.replace("instagram_business_", "").replace("instagram_", "")}</small>) : <small>{tr("Meta grant ro‘yxati qaytmadi", "Meta не вернула список разрешений", "Meta did not return the grant list")}</small>}</div>
      {canManage && <div className="account-card-actions"><button className="btn secondary small" onClick={() => void connect()} disabled={Boolean(busy) || !data?.meta_configured}><RefreshCw/>{tr("Qayta ulash", "Переподключить", "Reconnect")}</button><button className="btn danger ghost small" onClick={() => void disconnect(account)} disabled={Boolean(busy)}><Trash2/>{tr("Uzish", "Отключить", "Disconnect")}</button></div>}
    </article>)}</div>}
  </>;
}

export default function AccountsPage() {
  return <Suspense><AccountsContent/></Suspense>;
}
