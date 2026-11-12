"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, ChevronLeft, CircleHelp, Film, Instagram, LoaderCircle, LockKeyhole, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, UserCheck, Video, Zap } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { PreferencesControls, usePreferences } from "@/components/preferences-provider";
import { useApi } from "@/hooks/use-api";
import { ApiError, api, jsonBody } from "@/lib/api";
import type { Automation, InstagramAccount, InstagramMedia, User } from "@/lib/types";

type AuthState = "loading" | "ready" | "signed_out" | "error";
type AuthIntent = "login" | "register";
type AccountList = { items: InstagramAccount[]; provider: string; login_mode: string; meta_configured: boolean };
type SetupStep = 1 | 2 | 3 | 4;
type FallbackPolicy = Automation["unknown_fallback_policy"];
type InstagramLoginStatus = { enabled: boolean; provider: string; login_mode: string; api_ready: boolean };

const STEP_TITLES = {
  uz: ["Instagram ulash", "Video tanlash", "Sozlamalar", "Boshlash"],
  ru: ["Подключить Instagram", "Выбрать видео", "Настройки", "Запустить"],
  en: ["Connect Instagram", "Choose posts", "Settings", "Launch"],
} as const;

function initialStep(value: string | null): SetupStep {
  const number = Number(value);
  return number === 2 || number === 3 || number === 4 ? number : 1;
}

export function SetupWizard() {
  const { locale, tr } = usePreferences();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<SetupStep>(() => initialStep(searchParams.get("step")));
  const [accountID, setAccountID] = useState(() => searchParams.get("account") ?? "");
  const [mediaScope, setMediaScope] = useState<"all" | "selected">("all");
  const [mediaIDs, setMediaIDs] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [matchMode, setMatchMode] = useState<Automation["match_mode"]>("contains");
  const [privateText, setPrivateText] = useState("");
  const [publicSuccess, setPublicSuccess] = useState("");
  const [publicNotFollower, setPublicNotFollower] = useState("");
  const [publicUnknown, setPublicUnknown] = useState("");
  const [followCheck, setFollowCheck] = useState(false);
  const [fallback, setFallback] = useState<FallbackPolicy>("skip_dm_neutral_reply");
  const [ruleName, setRuleName] = useState("");
  const [active, setActive] = useState(true);
  const [connectBusy, setConnectBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [authMode, setAuthMode] = useState<AuthIntent>(() => searchParams.get("auth_mode") === "login" ? "login" : "register");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [createdRule, setCreatedRule] = useState<Automation | null>(null);

  useEffect(() => {
    let current = true;
    api<{ user: User }>("/me")
      .then((response) => {
        if (!current) return;
        setUser(response.user);
        setAuthState("ready");
      })
      .catch((error: unknown) => {
        if (!current) return;
        if (error instanceof ApiError && error.status === 401) {
          setAuthState("signed_out");
          return;
        }
        setAuthError(error instanceof Error ? error.message : tr("Hisobni tekshirib bo‘lmadi", "Не удалось проверить аккаунт", "Could not verify the account"));
        setAuthState("error");
      });
    return () => { current = false; };
  }, [tr]);

  useEffect(() => {
    if (authState === "ready" && searchParams.get("auth_mode") === "login") router.replace("/app");
  }, [authState, router, searchParams]);

  const accounts = useApi<AccountList>(authState === "ready" ? "/instagram/accounts" : null);
  const instagramLogin = useApi<InstagramLoginStatus>(authState === "signed_out" ? "/auth/instagram/status" : null);
  const connectedAccounts = accounts.data?.items.filter((item) => item.status === "connected") ?? [];
  const selectedAccount = connectedAccounts.find((item) => item.id === accountID) ?? null;
  const safeStep: SetupStep = step > 1 && !selectedAccount ? 1 : step;
  const mediaPath = selectedAccount && mediaScope === "selected"
    ? `/instagram/accounts/${encodeURIComponent(selectedAccount.id)}/media`
    : null;
  const media = useApi<{ items: InstagramMedia[] }>(mediaPath);
  const canManage = user?.role === "owner" || user?.role === "manager";
  const localeTitles = STEP_TITLES[locale];
  const accountName = selectedAccount ? `@${selectedAccount.username}` : "Instagram";

  function go(next: SetupStep) {
    setMessage("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function connectInstagram() {
    if (!canManage || !accounts.data?.meta_configured) return;
    setConnectBusy(true);
    setMessage("");
    try {
      const result = await api<{ authorization_url: string }>("/instagram/connect");
      window.location.assign(result.authorization_url);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : tr("Instagram ulash boshlanmadi", "Не удалось начать подключение Instagram", "Could not start Instagram connection"));
      setConnectBusy(false);
    }
  }

  async function startInstagramLogin() {
    if (!acceptTerms || !instagramLogin.data?.enabled) return;
    setLoginBusy(true);
    setAuthError("");
    try {
      const result = await api<{ authorization_url: string }>("/auth/instagram/start", {
        method: "POST",
        ...jsonBody({ intent: authMode, accept_terms: true, remember_me: rememberMe }),
      });
      window.location.assign(result.authorization_url);
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : tr("Instagram ulanishi boshlanmadi", "Не удалось начать вход через Instagram", "Could not start Instagram sign-in"));
      setLoginBusy(false);
    }
  }

  function addKeyword(raw: string) {
    const value = raw.trim().replace(/,$/, "").trim();
    if (!value) return;
    setKeywords((current) => current.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase()) || current.length >= 20 ? current : [...current, value]);
    setKeywordInput("");
  }

  function toggleMedia(id: string) {
    setMediaIDs((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 50 ? [...current, id] : current);
  }

  function continueFromAccount() {
    if (!selectedAccount) {
      setMessage(tr("Davom etish uchun ulangan Instagram akkauntni tanlang.", "Выберите подключённый Instagram аккаунт.", "Choose a connected Instagram account to continue."));
      return;
    }
    if (!canManage) {
      setMessage(tr("Instagram ulash va automation yaratish uchun Manager yoki Owner roli kerak.", "Для подключения и создания автоматизации нужна роль Manager или Owner.", "Manager or Owner access is required to connect Instagram and create automations."));
      return;
    }
    go(2);
  }

  function continueFromMedia() {
    if (mediaScope === "selected" && mediaIDs.length === 0) {
      setMessage(tr("Kamida bitta real post yoki videoni tanlang.", "Выберите хотя бы одну публикацию или видео.", "Select at least one real post or video."));
      return;
    }
    go(3);
  }

  function continueFromSettings() {
    const pendingKeywords = [...keywords];
    const pending = keywordInput.trim();
    if (pending && !pendingKeywords.some((item) => item.toLocaleLowerCase() === pending.toLocaleLowerCase()) && pendingKeywords.length < 20) pendingKeywords.push(pending);
    setKeywords(pendingKeywords);
    setKeywordInput("");
    if (!pendingKeywords.length) {
      setMessage(tr("Kamida bitta kalit so‘z qo‘shing.", "Добавьте хотя бы одно ключевое слово.", "Add at least one keyword."));
      return;
    }
    if (!privateText.trim() || !publicSuccess.trim() || (followCheck && (!publicNotFollower.trim() || !publicUnknown.trim()))) {
      setMessage(tr("Majburiy xabar matnlarini to‘ldiring.", "Заполните обязательные тексты ответов.", "Complete the required reply messages."));
      return;
    }
    setMessage("");
    if (!ruleName.trim()) setRuleName(tr(`@${selectedAccount?.username ?? "Instagram"} comment javoblari`, `Ответы на комментарии @${selectedAccount?.username ?? "Instagram"}`, `@${selectedAccount?.username ?? "Instagram"} comment replies`));
    go(4);
  }

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitBusy) return;
    if (!selectedAccount) {
      setMessage(tr("Instagram akkauntini qayta tanlang.", "Снова выберите аккаунт Instagram.", "Select the Instagram account again."));
      return;
    }
    if (!canManage) {
      setMessage(tr("Qoida yaratish uchun workspace Manager yoki Owner ruxsati kerak.", "Для создания правила нужны права Manager или Owner workspace.", "Manager or Owner access is required to create a rule."));
      return;
    }
    if (mediaScope === "selected" && mediaIDs.length === 0) {
      setMessage(tr("Kamida bitta post yoki videoni tanlang.", "Выберите хотя бы одну публикацию или видео.", "Select at least one post or video."));
      return;
    }
    if (keywords.length === 0 || !privateText.trim() || !publicSuccess.trim() || (followCheck && (!publicNotFollower.trim() || !publicUnknown.trim()))) {
      setMessage(tr("Kalit so‘z va majburiy javob matnlarini tekshiring.", "Проверьте ключевые слова и обязательные тексты ответов.", "Check the keyword and required reply messages."));
      return;
    }
    const normalizedName = ruleName.trim() || tr(
      `@${selectedAccount.username} comment javoblari`,
      `Ответы на комментарии @${selectedAccount.username}`,
      `@${selectedAccount.username} comment replies`,
    );
    setRuleName(normalizedName);
    setSubmitBusy(true);
    setMessage("");
    try {
      const created = await api<Automation>("/automations", {
        method: "POST",
        ...jsonBody({
          name: normalizedName,
          instagram_account_id: selectedAccount.id,
          match_mode: matchMode,
          keywords,
          exclusions: [],
          media_scope: mediaScope,
          media_ids: mediaScope === "selected" ? mediaIDs : [],
          private_reply_text: privateText.trim(),
          public_success_reply_text: publicSuccess.trim(),
          public_not_follower_reply_text: publicNotFollower.trim() || publicSuccess.trim(),
          public_unknown_reply_text: publicUnknown.trim() || publicSuccess.trim(),
          follow_verification_enabled: followCheck,
          unknown_fallback_policy: fallback,
          is_active: active,
          priority: 100,
        }),
      });
      if (!created.id) throw new Error(tr("Server qoidani saqlagani tasdiqlamadi.", "Сервер не подтвердил сохранение правила.", "The server did not confirm that the rule was saved."));
      setCreatedRule(created);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : error instanceof Error ? error.message : tr("Automation saqlanmadi", "Не удалось сохранить автоматизацию", "Could not save the automation"));
    } finally {
      setSubmitBusy(false);
    }
  }

  if (authState === "loading") return <SetupShell><div className="setup-state"><LoaderCircle className="setup-spinner"/><span>{tr("Xavfsiz ulanish tekshirilmoqda…", "Проверяем безопасное подключение…", "Checking your secure session…")}</span></div></SetupShell>;

  if (authState === "signed_out") {
    const oauthCode = searchParams.get("instagram_error");
    const oauthMessage = oauthCode === "cancelled"
      ? tr("Instagram ulash bekor qilindi. Istasangiz, qaytadan boshlang.", "Подключение Instagram отменено. Вы можете попробовать ещё раз.", "Instagram sign-in was cancelled. You can try again.")
      : oauthCode === "account_not_found"
        ? tr("Bu Instagram hisobi IDS Automate’da mavjud emas. Iltimos, ro‘yxatdan o‘ting.", "Аккаунт Instagram ещё не зарегистрирован в IDS Automate. Пожалуйста, зарегистрируйтесь.", "This Instagram account does not have an IDS Automate account yet. Please register.")
        : oauthCode === "account_already_exists"
          ? tr("Bu Instagram hisobi allaqachon mavjud. Kirish bo‘limidan kiring.", "Этот аккаунт Instagram уже зарегистрирован. Перейдите ко входу.", "This Instagram account is already registered. Please use Sign in.")
      : oauthCode === "account_conflict"
        ? tr("Bu Instagram akkaunti boshqa workspace’ga ulangan. Avvalgi IDS ma’lumotlari egasi bilan bog‘laning.", "Этот Instagram аккаунт уже подключён к другому workspace. Свяжитесь с владельцем прежних данных IDS.", "This Instagram account is already connected to another workspace. Contact the owner of the existing IDS data.")
        : oauthCode === "oauth_token_exchange_failed"
          ? tr("Meta ruxsat kodini token bilan almashtirmadi. Ulanishni qayta boshlang; takrorlansa Meta App ID/Secret va callback manzili aynan mosligini tekshiring.", "Meta не обменяла код разрешения на токен. Начните подключение заново; если ошибка повторится, проверьте Meta App ID/Secret и точное совпадение callback URL.", "Meta did not exchange the authorization code for a token. Restart the connection; if it repeats, verify the Meta App ID/Secret and exact callback URL.")
          : oauthCode === "instagram_asset_access_failed"
            ? tr("Meta akkauntlar ro‘yxatini bera olmadi. Unified Login konfiguratsiyasida Professional akkaunt va kerakli ruxsatlarni tekshiring.", "Meta не вернула список аккаунтов. Проверьте Professional аккаунт и разрешения в конфигурации Unified Login.", "Meta could not list Instagram accounts. Check the Professional account asset and required Unified Login permissions.")
            : oauthCode === "instagram_asset_not_shared"
              ? tr("Meta ruxsatni qabul qildi, ammo akkauntlar API’si 0 ta Instagram akkaunt qaytardi. Instagram profilingiz Business yoki Creator turiga o‘tkazilganini, tanlangan Business Portfolio’da Instagram akkaunt sifatida mavjudligini va aynan shu hisob Meta konfiguratsiyasida ulashish uchun tanlanganini tekshiring. Hozircha akkaunt ham, token ham saqlanmadi.", "Meta приняла разрешение, но API вернул 0 аккаунтов Instagram. Убедитесь, что профиль переведён в тип Business или Creator, добавлен как аккаунт Instagram в выбранный Business Portfolio и выбран в конфигурации Meta для передачи приложению. Аккаунт и токен не сохранены.", "Meta accepted the permission, but its account API returned 0 Instagram accounts. Check that the profile is a Business or Creator account, is present in the selected Business Portfolio as an Instagram account, and is selected for sharing in the Meta configuration. No account or token was saved.")
              : oauthCode === "multiple_instagram_assets"
                ? tr("Meta bir nechta akkauntni qaytardi. Konfiguratsiyada bitta kerakli Instagram akkauntini tanlang.", "Meta вернула несколько аккаунтов. Выберите один нужный Instagram аккаунт в конфигурации.", "Meta returned multiple accounts. Select one intended Instagram account in the configuration.")
                : oauthCode === "webhook_subscription_failed"
                  ? tr("Akkaunt aniqlandi, ammo webhook ruxsati tasdiqlanmadi. Meta App’dagi comments/messages sozlamalarini tekshiring.", "Аккаунт найден, но разрешение webhook не подтверждено. Проверьте настройки comments/messages в Meta App.", "The account was found, but webhook access was not confirmed. Check comments/messages settings in the Meta App.")
        : oauthCode
          ? tr("Instagram orqali kirish yakunlanmadi. Meta sozlamalarini tekshirib, qayta urinib ko‘ring.", "Не удалось завершить вход через Instagram. Проверьте настройки Meta и попробуйте снова.", "Instagram sign-in did not complete. Check the Meta configuration and try again.")
          : "";
    return <SetupShell><div className="setup-auth-card"><span className="setup-state-icon"><Instagram/></span><span className="setup-eyebrow">{tr("IDS WORKSPACE · INSTAGRAM", "IDS WORKSPACE · INSTAGRAM", "IDS WORKSPACE · INSTAGRAM")}</span><h1>{authMode === "login" ? tr("Instagram bilan kirish", "Войти через Instagram", "Sign in with Instagram") : tr("Instagram bilan ro‘yxatdan o‘tish", "Регистрация через Instagram", "Create an account with Instagram")}</h1><p>{authMode === "login" ? tr("Mavjud IDS hisobingizga ulangan Instagram akkauntni rasmiy Meta oynasida tasdiqlang.", "Подтвердите в официальном окне Meta Instagram аккаунт, связанный с вашим IDS.", "Confirm the Instagram account linked to your IDS account in Meta’s official window.") : tr("Instagram akkauntingizni rasmiy Meta oynasida tasdiqlang. Yangi IDS hisobingiz Instagram bilan yaratiladi.", "Подтвердите аккаунт Instagram в официальном окне Meta. Новый аккаунт IDS будет создан через Instagram.", "Confirm your Instagram account in Meta’s official window to create a new IDS account.")}</p>
      <div className="setup-auth-mode" role="group" aria-label={tr("Kirish usuli", "Способ входа", "Account access mode")}>
        <button type="button" className={authMode === "login" ? "active" : ""} aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setAuthError(""); }}>{tr("Kirish", "Войти", "Sign in")}</button>
        <button type="button" className={authMode === "register" ? "active" : ""} aria-pressed={authMode === "register"} onClick={() => { setAuthMode("register"); setAuthError(""); }}>{tr("Ro‘yxatdan o‘tish", "Регистрация", "Create account")}</button>
      </div>
      {oauthMessage && <div className="setup-inline-message" role="alert"><AlertCircle/><span>{oauthMessage}</span></div>}
      {authError && <div className="setup-inline-message" role="alert"><AlertCircle/><span>{authError}</span></div>}
      {instagramLogin.loading && <div className="setup-state"><LoaderCircle className="setup-spinner"/><span>{tr("Meta ulanishi tekshirilmoqda…", "Проверяем Meta…", "Checking Meta availability…")}</span></div>}
      {!instagramLogin.loading && (instagramLogin.error || !instagramLogin.data?.enabled) && <div className="setup-notice warning"><AlertCircle/><span>{instagramLogin.error || tr("Meta OAuth hozir serverda sozlanmagan. Instagram login tugmasi Meta credentials tayyor bo‘lgach yoqiladi.", "Meta OAuth ещё не настроен на сервере. Кнопка входа включится после настройки Meta credentials.", "Meta OAuth is not configured on the server yet. Instagram sign-in will be available when the Meta credentials are ready.")}</span></div>}
      {!instagramLogin.loading && instagramLogin.data?.enabled && !instagramLogin.data.api_ready && <div className="setup-notice warning"><AlertCircle/><span>{tr("Instagram OAuth urinishiga ruxsat bor, ammo webhook konfiguratsiyasi to‘liq bo‘lmagani uchun comment avtomatizatsiyasi hali ishlashga tayyor emas.", "Вход Instagram доступен, но автоматизация комментариев пока не готова: не завершена настройка webhook.", "Instagram OAuth can be attempted, but comment automation is not ready until the webhook configuration is complete.")}</span></div>}
      <label className="check terms"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)}/><span>{tr("Men", "Я принимаю", "I accept the")} <Link href="/terms">{tr("Foydalanish shartlari", "Условия использования", "Terms of use")}</Link> {tr("va", "и", "and")} <Link href="/privacy">{tr("Maxfiylik siyosati", "Политику конфиденциальности", "Privacy policy")}</Link></span></label>
      <label className="setup-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)}/><span>{tr("Meni eslab qolish (30 kun)", "Запомнить меня (30 дней)", "Remember me (30 days)")}</span></label>
      <div className="setup-button-row"><button className="btn primary large" type="button" disabled={loginBusy || instagramLogin.loading || !instagramLogin.data?.enabled || !acceptTerms} onClick={() => void startInstagramLogin()}><Instagram/>{loginBusy ? tr("Meta oynasi ochilmoqda…", "Открываем Meta…", "Opening Meta…") : authMode === "login" ? tr("Instagram bilan kirish", "Войти через Instagram", "Sign in with Instagram") : tr("Instagram bilan ro‘yxatdan o‘tish", "Зарегистрироваться через Instagram", "Create account with Instagram")}<ArrowRight/></button></div>
      <div className="setup-login-assurance"><ShieldCheck/><span>{authMode === "login" ? tr("Bu qurilmada 30 kungacha saqlanadigan sessiya ochiladi. Boshqa qurilmalarda ham Instagram bilan alohida kirishingiz mumkin. Parolingiz IDS serveriga kelmaydi.", "Сессия на этом устройстве сохранится до 30 дней. На других устройствах можно отдельно войти через Instagram. Пароль не передаётся IDS.", "Your session can stay signed in on this device for up to 30 days. Sign in separately on other devices. Your password never reaches IDS.") : tr("Instagram parolingiz IDS serveriga kelmaydi. Yangi himoyalangan workspace faqat rasmiy Meta tasdig‘idan keyin yaratiladi.", "Пароль Instagram не попадает на сервер IDS. Новый защищённый workspace создаётся только после подтверждения Meta.", "Your Instagram password never reaches IDS. A new protected workspace is created only after Meta confirms your account.")}</span></div>
    </div></SetupShell>;
  }

  if (authState === "error") return <SetupShell><div className="setup-state setup-error"><AlertCircle/><span>{authError}</span><button className="btn secondary" onClick={() => window.location.reload()}><RefreshCw/>{tr("Qayta yuklash", "Повторить", "Try again")}</button></div></SetupShell>;

  if (createdRule) return <SetupShell><div className="setup-complete"><span className="setup-complete-icon"><CheckCircle2/></span><span className="setup-eyebrow">{tr("Saqlandi", "Сохранено", "Saved")}</span><h1>{tr("Automation tayyor", "Автоматизация готова", "Automation is ready")}</h1><p>{active ? tr("Qoida faol. Ulangan akkauntdan yangi mos comment webhook orqali kelganda ishlaydi.", "Правило активно. Оно сработает, когда новый подходящий комментарий придёт через webhook.", "The rule is active. It will run when a new matching comment arrives through the connected account’s webhook.") : tr("Qoida saqlandi, ammo o‘chiq turibdi. Keyinroq automation sahifasidan yoqishingiz mumkin.", "Правило сохранено, но выключено. Его можно включить позже на странице автоматизаций.", "The rule was saved but is disabled. You can turn it on later from Automations.")}</p><div className="setup-success-summary"><span><Instagram/> {accountName}</span><span><Sparkles/> {keywords.join(", ")}</span><span><ShieldCheck/> {active ? tr("Faol", "Активна", "Active") : tr("O‘chiq", "Выключена", "Disabled")}</span></div><div className="setup-button-row"><Link className="btn primary large" href={`/app/automations/${createdRule.id}`}>{tr("Automation’ni ko‘rish", "Открыть автоматизацию", "View automation")} <ArrowRight/></Link><Link className="btn secondary large" href="/app">{tr("Boshqaruv paneli", "Панель управления", "Dashboard")}</Link></div></div></SetupShell>;

  const mediaItems = media.data?.items ?? [];

  return <SetupShell>
    <main className="setup-main">
      <section className="setup-heading">
        <span className="setup-eyebrow">{tr("IDS AUTOMATE · COMMENT-TO-DM", "IDS AUTOMATE · COMMENT-TO-DM", "IDS AUTOMATE · COMMENT-TO-DM")}</span>
        <h1>{tr("Instagram automation’ni sozlang", "Настройте автоматизацию Instagram", "Set up your Instagram automation")}</h1>
        <p>{tr("Akkauntdan birinchi qoidagacha — sodda to‘rt qadam.", "От подключения аккаунта до первого правила — четыре шага.", "Go from account connection to your first rule in four clear steps.")}</p>
      </section>

      <nav className="setup-progress" aria-label={tr("Sozlash bosqichlari", "Этапы настройки", "Setup steps")}>
        {localeTitles.map((title, index) => {
          const number = (index + 1) as SetupStep;
          const done = safeStep > number;
          const current = safeStep === number;
          return <div className={`setup-progress-step ${current ? "current" : ""} ${done ? "done" : ""}`} key={title} aria-current={current ? "step" : undefined}><span>{done ? <Check/> : number}</span><strong>{title}</strong></div>;
        })}
      </nav>

      {message && safeStep !== 4 && <div className="setup-inline-message" role="alert"><CircleHelp/><span>{message}</span><button type="button" aria-label={tr("Yopish", "Закрыть", "Dismiss")} onClick={() => setMessage("")}>×</button></div>}

      {safeStep === 1 && <section className="setup-card setup-account-step">
        <div className="setup-card-heading"><div><span>{tr("1-QADAM", "ШАГ 1", "STEP 1")}</span><h2>{tr("Instagram akkauntingizni ulang", "Подключите Instagram аккаунт", "Connect your Instagram account")}</h2><p>{tr("Faqat rasmiy Meta login oynasi orqali. Parolingiz IDS Automate’ga berilmaydi.", "Только через официальное окно Meta. Пароль не передаётся IDS Automate.", "Only through Meta’s official login. IDS Automate never receives your password.")}</p></div><span className="setup-card-icon"><Instagram/></span></div>
        {accounts.loading ? <div className="setup-state"><LoaderCircle className="setup-spinner"/><span>{tr("Ulangan akkauntlar yuklanmoqda…", "Загружаем подключённые аккаунты…", "Loading connected accounts…")}</span></div> : accounts.error ? <div className="setup-fetch-error"><AlertCircle/><span>{accounts.error}</span><button className="btn secondary small" onClick={() => void accounts.reload()} disabled={accounts.loading}><RefreshCw/>{tr("Qayta yuklash", "Повторить", "Retry")}</button></div> : <>
          {!accounts.data?.meta_configured && <div className="setup-notice warning"><AlertCircle/><span>{tr("Meta comment webhook sozlamalari to‘liq emas. Ulangan akkauntni sozlashingiz mumkin, ammo live comment avtomatizatsiyasi webhook tayyor bo‘lmaguncha ishlamaydi.", "Настройки Meta comment webhook заполнены не полностью. Можно настроить подключённый аккаунт, но live автоматизация комментариев не заработает до настройки webhook.", "Meta comment webhook settings are incomplete. You can configure the connected account, but live comment automation will not work until the webhook is ready.")}</span></div>}
          {connectedAccounts.length > 0 && <div className="setup-account-list" role="radiogroup" aria-label={tr("Instagram akkauntlari", "Аккаунты Instagram", "Instagram accounts")}>
            {connectedAccounts.map((account) => <button type="button" key={account.id} role="radio" aria-checked={accountID === account.id} className={`setup-account-option ${accountID === account.id ? "selected" : ""}`} onClick={() => { setAccountID(account.id); setMediaIDs([]); }}>
              <span className="setup-account-avatar"><Instagram/></span><span className="setup-account-info"><strong>@{account.username}</strong><small>{account.account_type === "UNKNOWN" ? tr("Meta qaytargan akkaunt · turi ko‘rsatilmagan", "Аккаунт Meta · тип не указан", "Meta-linked account · subtype not returned") : account.account_type}</small></span><span className="setup-account-status"><CheckCircle2/>{tr("Ulangan", "Подключён", "Connected")}</span>{accountID === account.id && <Check className="setup-account-check"/>}
            </button>)}
          </div>}
          {connectedAccounts.length === 0 && <div className="setup-connect-panel"><span className="setup-instagram-mark"><Instagram/></span><div><strong>{tr("Hali Instagram ulanmagan", "Instagram ещё не подключён", "No Instagram account connected yet")}</strong><p>{tr("Rasmiy Meta oynasida akkauntni tanlab, kerakli ruxsatlarni tasdiqlang.", "Выберите аккаунт в официальном окне Meta и подтвердите необходимые разрешения.", "Choose an account in Meta’s official window and approve the requested permissions.")}</p></div></div>}
          {accounts.data?.login_mode === "unified" && <div className="setup-notice"><ShieldCheck/><span>{tr("Meta Unified Login ishlatiladi. Follower holati ushbu yo‘lda tasdiqlanmasa, keyingi bosqichda UNKNOWN fallback tanlaysiz.", "Используется Meta Unified Login. Если статус подписки недоступен, на следующем шаге выберите UNKNOWN fallback.", "Meta Unified Login is active. If follower status is unavailable for this login path, you will choose an explicit UNKNOWN fallback next.")}</span></div>}
          <div className="setup-security-note"><LockKeyhole/><span>{tr("Token serverda shifrlanadi · Workspace ma’lumotlari ajratilgan", "Токен шифруется на сервере · Данные workspace изолированы", "Token encrypted on the server · Workspace data stays isolated")}</span></div>
          <div className="setup-actions">
            {connectedAccounts.length === 0 ? <button type="button" className="btn primary large" onClick={() => void connectInstagram()} disabled={connectBusy || !canManage || !accounts.data?.meta_configured}>{connectBusy ? <LoaderCircle className="setup-spinner"/> : <Instagram/>}{connectBusy ? tr("Meta ochilmoqda…", "Открываем Meta…", "Opening Meta…") : tr("Instagram bilan ulash", "Подключить Instagram", "Connect Instagram")} <ArrowRight/></button> : <button type="button" className="btn primary large" onClick={continueFromAccount} disabled={!selectedAccount || !canManage}>{tr("Davom etish", "Продолжить", "Continue")} <ArrowRight/></button>}
            {!canManage && <small>{tr("Akkaunt ulash uchun Manager yoki Owner ruxsati kerak.", "Для подключения нужен доступ Manager или Owner.", "Manager or Owner access is required to connect an account.")}</small>}
          </div>
        </>}
      </section>}

      {safeStep === 2 && selectedAccount && <section className="setup-card">
        <div className="setup-card-heading"><div><span>{tr("2-QADAM", "ШАГ 2", "STEP 2")}</span><h2>{tr("Qaysi postlarda ishlasin?", "Для каких публикаций включить?", "Which posts should use this rule?")}</h2><p>{tr("Postlar ulangan Instagram akkauntingizdan real vaqtda olinadi.", "Публикации загружаются из подключённого аккаунта Instagram.", "Posts are fetched from your connected Instagram account.")}</p></div><span className="setup-card-icon"><Video/></span></div>
        <div className="setup-selected-account"><Instagram/><span>{accountName}</span><button type="button" onClick={() => go(1)}>{tr("O‘zgartirish", "Изменить", "Change")}</button></div>
        <div className="setup-scope-options">
          <button type="button" className={mediaScope === "all" ? "selected" : ""} aria-pressed={mediaScope === "all"} onClick={() => { setMediaScope("all"); setMediaIDs([]); }}><span className="setup-scope-icon"><Sparkles/></span><span><strong>{tr("Barcha postlar", "Все публикации", "All posts")}</strong><small>{tr("Hozirgi va keyingi mos postlarda ishlaydi", "Работает для текущих и новых подходящих публикаций", "Applies to current and future eligible posts")}</small></span>{mediaScope === "all" && <CheckCircle2/>}</button>
          <button type="button" className={mediaScope === "selected" ? "selected" : ""} aria-pressed={mediaScope === "selected"} onClick={() => { setMediaScope("selected"); setMediaIDs([]); }}><span className="setup-scope-icon"><Film/></span><span><strong>{tr("Aniq post yoki videoni tanlash", "Выбрать конкретные публикации", "Choose specific posts or videos")}</strong><small>{tr("Faqat tanlaganlaringizda ishlaydi", "Работает только для выбранных публикаций", "Runs only on the posts you select")}</small></span>{mediaScope === "selected" && <CheckCircle2/>}</button>
        </div>
        {mediaScope === "selected" && <div className="setup-media-section">
          <div className="setup-media-title"><div><strong>{tr("Instagram postlari", "Публикации Instagram", "Instagram posts")}</strong><small>{tr(`${mediaIDs.length} ta tanlandi`, `Выбрано: ${mediaIDs.length}`, `${mediaIDs.length} selected`)}</small></div><button className="btn secondary small" onClick={() => void media.reload()} disabled={media.loading}><RefreshCw/>{tr("Yangilash", "Обновить", "Refresh")}</button></div>
          {media.loading ? <div className="setup-state"><LoaderCircle className="setup-spinner"/><span>{tr("Postlar Meta’dan olinmoqda…", "Загружаем публикации из Meta…", "Fetching posts from Meta…")}</span></div> : media.error ? <div className="setup-fetch-error"><AlertCircle/><span>{media.error}</span><button className="btn secondary small" onClick={() => void media.reload()}><RefreshCw/>{tr("Qayta urinish", "Повторить", "Retry")}</button></div> : mediaItems.length === 0 ? <div className="setup-empty"><Film/><span>{tr("Meta bu akkaunt uchun tanlanadigan post qaytarmadi.", "Meta не вернула публикации для этого аккаунта.", "Meta returned no selectable posts for this account.")}</span></div> : <div className="setup-media-grid">{mediaItems.map((item) => {
            const image = item.thumbnail_url || item.media_url;
            const selected = mediaIDs.includes(item.id);
            return <button key={item.id} type="button" className={`setup-media-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => toggleMedia(item.id)}>
              <span className="setup-media-art" style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined}>{!image && <Film/>}<small>{item.media_product_type === "REELS" ? "Reels" : item.media_type === "VIDEO" ? tr("Video", "Видео", "Video") : tr("Post", "Публикация", "Post")}</small>{selected && <i><Check/></i>}</span>
              <span className="setup-media-copy"><strong>{item.caption?.trim() || tr("Matnsiz post", "Публикация без текста", "Post without a caption")}</strong><small>{item.timestamp ? new Date(item.timestamp).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ") : ""}</small></span>
            </button>;
          })}</div>}
        </div>}
        <div className="setup-actions"><button className="btn secondary" onClick={() => go(1)}><ChevronLeft/>{tr("Orqaga", "Назад", "Back")}</button><button className="btn primary" onClick={continueFromMedia}>{tr("Davom etish", "Продолжить", "Continue")} <ArrowRight/></button></div>
      </section>}

      {safeStep === 3 && selectedAccount && <section className="setup-card">
        <div className="setup-card-heading"><div><span>{tr("3-QADAM", "ШАГ 3", "STEP 3")}</span><h2>{tr("Kalit so‘z va javoblarni sozlang", "Настройте ключевые слова и ответы", "Set your keywords and replies")}</h2><p>{tr("Mos comment kelganda nima bo‘lishini aniq belgilang.", "Укажите, что делать при совпадении комментария.", "Define exactly what happens when a comment matches.")}</p></div><span className="setup-card-icon"><Sparkles/></span></div>
        <div className="setup-field-block"><label className="setup-label" htmlFor="keyword-input">{tr("Kalit so‘zlar", "Ключевые слова", "Keywords")} <small>{tr("20 tagacha", "До 20", "Up to 20")}</small></label><div className="setup-keyword-box"><div className="setup-keyword-chips">{keywords.map((item) => <span className="setup-keyword-chip" key={item}>{item}<button type="button" aria-label={tr(`${item} kalit so‘zini olib tashlash`, `Удалить ключевое слово ${item}`, `Remove keyword ${item}`)} onClick={() => setKeywords((current) => current.filter((keyword) => keyword !== item))}>×</button></span>)}<input id="keyword-input" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addKeyword(keywordInput); } if (event.key === "Backspace" && !keywordInput && keywords.length) setKeywords((current) => current.slice(0, -1)); }} placeholder={keywords.length ? tr("Yana kalit so‘z…", "Добавьте ещё слово…", "Add another keyword…") : tr("masalan: narx, katalog", "например: цена, каталог", "e.g. price, catalog")}/></div></div><small className="setup-help">{tr("Har bir so‘zni Enter yoki vergul bilan kiriting.", "Вводите слова через Enter или запятую.", "Press Enter or comma after each keyword.")}</small></div>
        <fieldset className="setup-field-block setup-mode-field"><legend className="setup-label">{tr("Moslik usuli", "Режим совпадения", "Matching mode")}</legend><div className="setup-mode-grid">{(["contains", "exact", "keyword_list"] as const).map((mode) => <button type="button" key={mode} aria-pressed={matchMode === mode} className={matchMode === mode ? "selected" : ""} onClick={() => setMatchMode(mode)}><strong>{mode === "contains" ? tr("Ichida bor", "Содержит", "Contains") : mode === "exact" ? tr("Aniq mos", "Точное совпадение", "Exact match") : tr("Alohida so‘z", "Отдельное слово", "Whole word")}</strong><small>{mode === "contains" ? tr("Matn ichidan qidiradi", "Ищет в тексте", "Finds keyword in the text") : mode === "exact" ? tr("Comment to‘liq teng bo‘lishi kerak", "Комментарий должен совпасть целиком", "Comment must match exactly") : tr("To‘liq alohida so‘zni qidiradi", "Ищет целое отдельное слово", "Matches a whole word")}</small>{matchMode === mode && <CheckCircle2/>}</button>)}</div></fieldset>
        <div className="setup-reply-grid"><label className="setup-field-block"><span className="setup-label">{tr("Private Direct xabari", "Личное сообщение Direct", "Private Direct message")} <small>{privateText.length}/1000</small></span><textarea value={privateText} onChange={(event) => setPrivateText(event.target.value)} maxLength={1000} rows={5} placeholder={tr("Assalomu alaykum! So‘ragan ma’lumotingizni yuboryapmiz.", "Здравствуйте! Отправляем запрошенную информацию.", "Hello! Here is the information you requested.")} required/><small className="setup-help">{tr("Bu xabar comment muallifiga Meta’ning private reply qoidasi orqali yuboriladi.", "Это сообщение отправляется автору комментария через private reply Meta.", "This goes to the commenter through Meta’s private reply mechanism.")}</small></label><label className="setup-field-block"><span className="setup-label">{tr("DM tasdiqlangach public comment", "Публичный ответ после подтверждения DM", "Public comment after confirmed DM")} <small>{publicSuccess.length}/1000</small></span><textarea value={publicSuccess} onChange={(event) => setPublicSuccess(event.target.value)} maxLength={1000} rows={5} placeholder={tr("Direct xabaringizga yubordik! 📩", "Отправили вам в Direct! 📩", "Sent it to your Direct messages! 📩")} required/><small className="setup-help">{tr("Faqat Meta DM muvaffaqiyatini tasdiqlasa e’lon qilinadi.", "Публикуется только после подтверждения успешной отправки DM Meta.", "Posted only after Meta confirms that the DM was accepted.")}</small></label></div>
        <div className="setup-follow-card"><div className="setup-follow-heading"><span className="setup-follow-icon"><UserCheck/></span><div><strong>{tr("Follower holatini tekshirish", "Проверять статус подписчика", "Verify follower status")}</strong><p>{tr("Ixtiyoriy. Natija faqat Meta aniq qaytarsa FOLLOWER yoki NOT_FOLLOWER bo‘ladi.", "Опционально. FOLLOWER или NOT_FOLLOWER показывается только при точном ответе Meta.", "Optional. FOLLOWER or NOT_FOLLOWER is used only when Meta returns a definitive result.")}</p></div><label className="setup-switch"><input type="checkbox" checked={followCheck} onChange={(event) => setFollowCheck(event.target.checked)}/><span/></label></div>
          {accounts.data?.login_mode === "unified" && followCheck && <div className="setup-notice warning"><AlertCircle/><span>{tr("Unified Login uchun follower tekshiruvi tasdiqlanmagan. Natija UNKNOWN bo‘lishi mumkin; bu NOT_FOLLOWER deb olinmaydi.", "Проверка подписки для Unified Login не подтверждена. Результат может быть UNKNOWN и не считается NOT_FOLLOWER.", "Follow verification is not confirmed for Unified Login. The result may be UNKNOWN and will not be treated as NOT_FOLLOWER.")}</span></div>}
          {followCheck && <div className="setup-fallback-area"><div className="setup-fallback-title"><CircleHelp/><div><strong>{tr("UNKNOWN fallback", "Политика для UNKNOWN", "UNKNOWN fallback")}</strong><small>{tr("Agar Meta holatni aniqlay olmasa", "Если Meta не сможет определить статус", "If Meta cannot determine follower status")}</small></div></div><div className="setup-fallback-options"><button type="button" aria-pressed={fallback === "send_private_reply"} className={fallback === "send_private_reply" ? "selected" : ""} onClick={() => setFallback("send_private_reply")}><Send/><span><strong>{tr("Ruxsat etilgan private reply’ni yuborish", "Отправить разрешённый private reply", "Send the permitted private reply")}</strong><small>{tr("Follow holati noma’lum bo‘lsa ham", "Даже если статус неизвестен", "Even when follow status is unknown")}</small></span>{fallback === "send_private_reply" && <CheckCircle2/>}</button><button type="button" aria-pressed={fallback === "skip_dm_neutral_reply"} className={fallback === "skip_dm_neutral_reply" ? "selected" : ""} onClick={() => setFallback("skip_dm_neutral_reply")}><MessageCircle/><span><strong>{tr("DM yubormaslik", "Не отправлять DM", "Skip the DM")}</strong><small>{tr("Neytral public javob ko‘rsatiladi", "Будет опубликован нейтральный ответ", "Post a neutral public reply")}</small></span>{fallback === "skip_dm_neutral_reply" && <CheckCircle2/>}</button></div>
            <div className="setup-reply-grid setup-fallback-replies"><label className="setup-field-block"><span className="setup-label">{tr("Obuna bo‘lmaganlar uchun", "Для неподписчиков", "For non-followers")} <small>{publicNotFollower.length}/1000</small></span><textarea value={publicNotFollower} onChange={(event) => setPublicNotFollower(event.target.value)} maxLength={1000} rows={3} placeholder={tr("Avval sahifamizga obuna bo‘ling! 😊", "Сначала подпишитесь на страницу! 😊", "Please follow our page first! 😊")} required={followCheck}/></label><label className="setup-field-block"><span className="setup-label">UNKNOWN holati uchun <small>{publicUnknown.length}/1000</small></span><textarea value={publicUnknown} onChange={(event) => setPublicUnknown(event.target.value)} maxLength={1000} rows={3} placeholder={tr("Iltimos, obuna bo‘ling va Direct orqali yozing.", "Подпишитесь и напишите нам в Direct.", "Please follow and message us in Direct.")} required={followCheck}/></label></div>
          </div>}
        </div>
        <div className="setup-actions"><button className="btn secondary" onClick={() => go(2)}><ChevronLeft/>{tr("Orqaga", "Назад", "Back")}</button><button className="btn primary" onClick={continueFromSettings}>{tr("Ko‘rib chiqish", "Проверить настройки", "Review setup")} <ArrowRight/></button></div>
      </section>}

      {safeStep === 4 && selectedAccount && <form className="setup-card" noValidate onSubmit={createRule}>
        <div className="setup-card-heading"><div><span>{tr("4-QADAM", "ШАГ 4", "STEP 4")}</span><h2>{tr("Qoidani ko‘rib chiqing", "Проверьте правило", "Review your rule")}</h2><p>{tr("Barchasi to‘g‘ri bo‘lsa, automation’ni ishga tushiring.", "Если всё верно, включите автоматизацию.", "Confirm the details and create your automation.")}</p></div><span className="setup-card-icon"><BadgeCheck/></span></div>
        <label className="setup-field-block"><span className="setup-label">{tr("Automation nomi", "Название автоматизации", "Automation name")}</span><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} onFocus={() => { if (!ruleName) setRuleName(tr(`@${selectedAccount.username} comment javoblari`, `Ответы на комментарии @${selectedAccount.username}`, `@${selectedAccount.username} comment replies`)); }} minLength={2} maxLength={100} required/></label>
        <div className="setup-review-grid"><div className="setup-review-line"><span><Instagram/></span><div><small>{tr("Akkaunt", "Аккаунт", "Account")}</small><strong>{accountName}</strong></div></div><div className="setup-review-line"><span><Video/></span><div><small>{tr("Postlar", "Публикации", "Posts")}</small><strong>{mediaScope === "all" ? tr("Barcha mos postlar", "Все подходящие публикации", "All eligible posts") : tr(`${mediaIDs.length} ta tanlangan`, `Выбрано: ${mediaIDs.length}`, `${mediaIDs.length} selected`)}</strong></div></div><div className="setup-review-line"><span><Sparkles/></span><div><small>{tr("Kalit so‘zlar", "Ключевые слова", "Keywords")}</small><strong>{keywords.join(", ")}</strong></div></div><div className="setup-review-line"><span><UserCheck/></span><div><small>{tr("Follow tekshiruvi", "Проверка подписки", "Follow verification")}</small><strong>{followCheck ? tr("Yoqilgan", "Включена", "On") : tr("O‘chirilgan", "Выключена", "Off")}</strong></div></div></div>
        <div className="setup-review-flow"><div><MessageCircle/><span><small>{tr("Comment mos keldi", "Комментарий совпал", "Comment matched")}</small><strong>{tr("Kalit so‘z", "Ключевое слово", "Keyword")}</strong></span></div><ArrowRight/><div><Send/><span><small>{tr("Meta DM’ni tasdiqlaydi", "Meta подтверждает DM", "Meta confirms DM")}</small><strong>{tr("Private reply", "Личный ответ", "Private reply")}</strong></span></div><ArrowRight/><div><CheckCircle2/><span><small>{tr("Faqat DM muvaffaqiyatli bo‘lsa", "Только после успешного DM", "Only after DM succeeds")}</small><strong>{tr("Public comment", "Публичный ответ", "Public reply")}</strong></span></div></div>
        <label className="setup-active-toggle"><span><strong>{tr("Saqlangach faollashtirish", "Активировать после сохранения", "Activate after saving")}</strong><small>{tr("O‘chirilsa qoida saqlanadi, lekin commentlarni qayta ishlamaydi.", "Если выключено, правило сохранится, но не будет обрабатывать комментарии.", "When off, the rule is saved but will not process comments.")}</small></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)}/></label>
        {message && <div className="setup-inline-message" role="alert" aria-live="assertive"><AlertCircle/><span>{message}</span><button type="button" aria-label={tr("Yopish", "Закрыть", "Dismiss")} onClick={() => setMessage("")}>×</button></div>}
        <div className="setup-actions"><button type="button" className="btn secondary" onClick={() => go(3)}><ChevronLeft/>{tr("Orqaga", "Назад", "Back")}</button><button type="submit" className="btn primary large" disabled={submitBusy}>{submitBusy ? <LoaderCircle className="setup-spinner"/> : <Zap/>}{submitBusy ? tr("Saqlanmoqda…", "Сохраняем…", "Saving…") : active ? tr("Automation’ni yoqish", "Включить автоматизацию", "Activate automation") : tr("Qoidani saqlash", "Сохранить правило", "Save rule")} {!submitBusy && <ArrowRight/>}</button></div>
      </form>}
      {!canManage && <div className="setup-notice warning"><ShieldCheck/><span>{tr("Automation yaratish uchun workspace Manager yoki Owner ruxsati kerak.", "Для создания автоматизации нужны права Manager или Owner в workspace.", "Workspace Manager or Owner access is required to create an automation.")}</span></div>}
      <p className="setup-footnote"><ShieldCheck/>{tr("Rasmiy Meta API · Takroriy javoblardan himoya · Har bir amal tarixda saqlanadi", "Официальный Meta API · Защита от дублей · История каждого действия", "Official Meta API · Duplicate reply protection · Every operation is recorded")}</p>
    </main>
  </SetupShell>;
}

export function SetupLoading() {
  const { tr } = usePreferences();
  return <SetupShell><div className="setup-state setup-initial-state"><LoaderCircle className="setup-spinner"/><span>{tr("Sozlash sahifasi ochilmoqda…", "Открываем страницу настройки…", "Opening setup…")}</span></div></SetupShell>;
}

function SetupShell({ children }: { children: React.ReactNode }) {
  const { tr } = usePreferences();
  return <div className="setup-page"><header className="setup-header"><Logo/><div className="setup-header-right"><PreferencesControls compact/><Link href="/" className="setup-home-link"><ArrowLeft/>{tr("Bosh sahifa", "На главную", "Home")}</Link></div></header>{children}</div>;
}
