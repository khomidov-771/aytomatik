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
    instagram_asset_access_failed: tr("Instagram profili aniqlanmadi. Business yoki Creator akkauntidan rasmiy Instagram oynasi orqali kiring va ruxsatlarni tekshiring.", "Не удалось определить профиль Instagram. Войдите через официальный экран Instagram с аккаунтом Business или Creator и проверьте разрешения.", "Instagram profile could not be identified. Sign in through Instagram’s official page with a Business or Creator account and approve the requested permissions."),
    instagram_asset_not_shared: tr("Instagram ruxsat berdi, lekin Professional akkaunt qaytmadi. Business yoki Creator hisobidan kirib qayta urinib ko‘ring.", "Instagram принял разрешение, но не вернул профессиональный аккаунт. Войдите через Business или Creator и повторите попытку.", "Instagram approved the request but returned no Professional account. Sign in with a Business or Creator account and try again."),
    instagram_professional_account_required: tr("Instagram API faqat Professional Business yoki Creator akkauntlarini qo‘llaydi. Profilingizni Instagram ilovasida Professional turga o‘tkazing.", "Instagram API поддерживает только профессиональные аккаунты Business или Creator. Переключите профиль в приложении Instagram на профессиональный тип.", "Instagram’s API supports only Professional Business or Creator accounts. Switch your profile to Professional in Instagram."),
    multiple_instagram_assets: tr("Instagram bir nechta akkaunt qaytardi. Ulamoqchi bo‘lgan Business yoki Creator akkauntini tanlang.", "Instagram вернул несколько аккаунтов. Выберите аккаунт Business или Creator, который хотите подключить.", "Instagram returned multiple accounts. Select the Business or Creator account you want to connect."),
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
  const providerLabel = data?.provider === "meta" ? "Instagram Login" : data?.provider;

  return <>
    <PageHeader
      eyebrow={tr("Integratsiyalar", "Интеграции", "Integrations")}
      title={tr("Instagram bilan kirish", "Вход через Instagram", "Connect with Instagram")}
      description={tr("Professional Business yoki Creator akkauntingizni rasmiy Instagram oynasi orqali ulang.", "Подключите Professional аккаунт Business или Creator через официальный экран Instagram.", "Connect your Professional Business or Creator account through Instagram’s official sign-in page.")}
      action={canManage ? <button className="btn primary" onClick={() => void connect()} disabled={busy === "connect" || !data?.meta_configured}><Instagram/>{busy === "connect" ? tr("Instagram ochilmoqda...", "Открываем Instagram...", "Opening Instagram...") : tr("Instagram bilan kirish", "Войти через Instagram", "Continue with Instagram")}</button> : undefined}
    />
    {data && !data.meta_configured && <div className="notice-banner warning"><AlertTriangle/><div><strong>{tr("Instagram Login sozlanmagan", "Instagram Login не настроен", "Instagram Login is not configured")}</strong><p>{tr("Serverda Instagram Login va webhook credentials to‘ldirilgandan so‘ng akkauntni ulash mumkin.", "Подключение станет доступно после настройки Instagram Login и webhook credentials на сервере.", "Connecting an account will be available after Instagram Login and webhook credentials are configured on the server.")}</p></div></div>}
    {items.some((item) => item.login_mode === "unified") && <div className="notice-banner warning"><AlertTriangle/><div><strong>{tr("Eski login orqali ulangan akkaunt", "Аккаунт подключён старым способом входа", "Account uses a legacy login")}</strong><p>{tr("Yangi ulanishlar Instagram Login orqali ochiladi. Eski Unified Login akkauntida follow tekshiruvi UNKNOWN bo‘lib qoladi.", "Новые подключения выполняются через Instagram Login. Для старого аккаунта Unified Login проверка подписки возвращает UNKNOWN.", "New connections use Instagram Login. Follow checks remain UNKNOWN for legacy Unified Login accounts.")}</p></div></div>}
    {!canManage && <div className="notice-banner warning"><ShieldCheck/><span>{tr("Akkauntni boshqarish uchun Manager yoki Owner roli kerak.", "Для управления аккаунтами нужна роль Manager или Owner.", "Manager or Owner role is required to manage accounts.")}</span></div>}
    {(notice || callbackNotice) && <div className={`notice-banner ${callbackError || notice ? "warning" : ""}`}><AlertTriangle/><span>{notice || callbackNotice}</span></div>}
    {recentlyConnectedAccount && <div className="setup-continue-banner"><div><BadgeCheck/><span><strong>{tr("Instagram ulandi", "Instagram подключён", "Instagram connected")}</strong><small>{tr("Endi post va avtomatik javoblarni tanlang.", "Теперь выберите публикации и автоматические ответы.", "Now choose posts and automated replies.")}</small></span></div><Link className="btn primary small" href={`/setup?step=2&account=${encodeURIComponent(recentlyConnectedAccount.id)}`}>{tr("Sozlashni davom ettirish", "Продолжить настройку", "Continue setup")} <Check/></Link></div>}
    {items.length === 0 && canManage && <section className="instagram-login-flow panel"><div className="login-flow-copy"><span className="instagram-login-mark"><Instagram/></span><div><h2>{tr("Akkauntingizni xavfsiz ulang", "Безопасно подключите аккаунт", "Connect your account securely")}</h2><p>{tr("Tugmani bosganda Instagram’ning rasmiy kirish sahifasi ochiladi. Login va parol IDS Automate serveriga kelmaydi.", "Откроется официальная страница входа Instagram. Логин и пароль не передаются на сервер IDS Automate.", "Instagram’s official sign-in page opens. Your username and password never reach IDS Automate.")}</p></div></div><div className="login-flow-steps"><div><span>1</span><strong>{tr("Instagram bilan kiring", "Войдите через Instagram", "Sign in with Instagram")}</strong></div><div><span>2</span><strong>{tr("Business yoki Creator akkauntni tanlang", "Выберите аккаунт Business или Creator", "Choose a Business or Creator account")}</strong></div><div><span>3</span><strong>{tr("Ruxsatlarni tasdiqlang", "Подтвердите разрешения", "Approve permissions")}</strong></div></div><div className="login-flow-security"><LockKeyhole/><span>{tr("Parol saqlanmaydi", "Пароль не сохраняется", "Password is not stored")}</span><BadgeCheck/><span>{tr("Faqat rasmiy Instagram API", "Только официальный Instagram API", "Official Instagram API only")}</span></div><button className="btn primary" onClick={() => void connect()} disabled={busy === "connect" || !data?.meta_configured}><Instagram/>{busy === "connect" ? tr("Instagram ochilmoqda...", "Открываем Instagram...", "Opening Instagram...") : tr("Instagram bilan davom etish", "Продолжить через Instagram", "Continue with Instagram")}</button></section>}
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
