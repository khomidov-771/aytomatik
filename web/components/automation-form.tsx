"use client";

import { AlertTriangle, Check, CheckCircle2, ChevronLeft, CircleHelp, Clock3, ExternalLink, Film, FlaskConical, Images, Instagram, MessageCircle, RefreshCw, Save, Send, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { Automation, AutomationExecution, InstagramAccount, InstagramMedia } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "./ui";
import { roleAtLeast, useSession } from "./session-context";
import { usePreferences } from "./preferences-provider";
import { SelectMenu } from "./select-menu";

const empty = {
  name: "",
  instagram_account_id: "",
  match_mode: "keyword_list",
  keywords: "narx",
  exclusions: "",
  media_scope: "selected",
  media_ids: "",
  private_reply_text: "Assalomu alaykum! So‘ragan ma’lumotingizni yuboryapmiz.",
  public_success_reply_text: "Direct xabaringizga yubordik! 📩",
  public_not_follower_reply_text: "Avval sahifamizga obuna bo‘ling! 😊",
  public_unknown_reply_text: "Iltimos, sahifamizga obuna bo‘ling va Direct orqali yozing.",
  follow_verification_enabled: false,
  unknown_fallback_policy: "skip_dm_neutral_reply",
  is_active: true,
  priority: 100,
};

type MatchPreview = {
  original_comment: string;
  normalized_comment: string;
  matched: boolean;
  matched_keyword: string;
  normalized_keyword: string;
  selected_automation: string;
  expected_action: string;
  sends_message: false;
};

function automationForm(automation: Automation) {
  return {
    name: automation.name,
    instagram_account_id: automation.instagram_account_id,
    match_mode: automation.match_mode,
    keywords: automation.keywords.join(", "),
    exclusions: automation.exclusions.join(", "),
    media_scope: automation.media_scope,
    media_ids: automation.media_ids.join(", "),
    private_reply_text: automation.private_reply_text,
    public_success_reply_text: automation.public_success_reply_text,
    public_not_follower_reply_text: automation.public_not_follower_reply_text,
    public_unknown_reply_text: automation.public_unknown_reply_text,
    follow_verification_enabled: automation.follow_verification_enabled,
    unknown_fallback_policy: automation.unknown_fallback_policy,
    is_active: automation.is_active,
    priority: automation.priority,
  };
}

export function AutomationForm({ id }: { id?: string }) {
  const { locale, tr } = usePreferences();
  const session = useSession();
  const canManage = roleAtLeast(session.user.role, "manager");
  const router = useRouter();
  const searchParams = useSearchParams();
  const accounts = useApi<{items: InstagramAccount[]}>("/instagram/accounts");
  const existing = useApi<Automation>(id ? `/automations/${id}` : null);
  const history = useApi<{items: AutomationExecution[]}>(id && !searchParams.has("copy") ? `/automations/${id}/executions` : null);
  const [draft, setDraft] = useState<typeof empty | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewComment, setPreviewComment] = useState("");
  const [matchPreview, setMatchPreview] = useState<MatchPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const copyMode = Boolean(id) && searchParams.has("copy");

  const localizedEmpty = {
    ...empty,
    keywords: tr("narx", "цена", "price"),
    private_reply_text: tr("Assalomu alaykum! So‘ragan ma’lumotingizni yuboryapmiz.", "Здравствуйте! Отправляем запрошенную информацию.", "Hello! Here is the information you requested."),
    public_success_reply_text: tr("Direct xabaringizga yubordik! 📩", "Отправили вам в Direct! 📩", "Sent it to your Direct messages! 📩"),
    public_not_follower_reply_text: tr("Avval sahifamizga obuna bo‘ling! 😊", "Сначала подпишитесь на нашу страницу! 😊", "Please follow our page first! 😊"),
    public_unknown_reply_text: tr("Iltimos, sahifamizga obuna bo‘ling va Direct orqali yozing.", "Пожалуйста, подпишитесь и напишите нам в Direct.", "Please follow our page and message us in Direct."),
  };
  const connectedAccounts = accounts.data?.items.filter((account) => account.status === "connected") ?? [];
  const initial = existing.data
    ? automationForm(existing.data)
    : { ...localizedEmpty, instagram_account_id: !id ? (connectedAccounts[0]?.id ?? "") : "" };
  const form = draft ?? initial;
  const media = useApi<{items: InstagramMedia[]}>(form.instagram_account_id && form.media_scope === "selected" ? `/instagram/accounts/${encodeURIComponent(form.instagram_account_id)}/media` : null);
  const selectedMediaIDs = form.media_ids.split(",").map((value) => value.trim()).filter(Boolean);
  const keywordList = form.keywords.split(",").map((value) => value.trim()).filter(Boolean);
  const selectedAccount = connectedAccounts.find((account) => account.id === form.instagram_account_id);
  const selectedMediaItems = media.data?.items.filter((item) => selectedMediaIDs.includes(item.id)) ?? [];

  function field(name: string, value: string | boolean | number) {
    setDraft({ ...form, [name]: value });
    setMatchPreview(null);
    setPreviewError("");
  }

  function selectAccount(accountID: string) {
    setDraft({ ...form, instagram_account_id: accountID, media_scope: "selected", media_ids: "" });
  }

  function selectMediaScope(scope: string) {
    setDraft({ ...form, media_scope: scope, media_ids: scope === "all" ? "" : form.media_ids });
  }

  function toggleMedia(mediaID: string) {
    const next = selectedMediaIDs.includes(mediaID)
      ? selectedMediaIDs.filter((value) => value !== mediaID)
      : [...selectedMediaIDs, mediaID];
    setDraft({ ...form, media_ids: next.join(", ") });
  }

  async function runMatchPreview() {
    setMatchPreview(null);
    setPreviewError("");
    if (!previewComment.trim() || keywordList.length === 0) {
      setPreviewError(tr("Comment namunasi va kamida bitta kalit so‘z kiriting.", "Введите пример комментария и хотя бы одно ключевое слово.", "Enter a sample comment and at least one keyword."));
      return;
    }
    setPreviewing(true);
    try {
      const result = await api<MatchPreview>("/automations/match-preview", {
        method: "POST",
        ...jsonBody({
          name: form.name.trim(),
          text: previewComment,
          match_mode: form.match_mode,
          keywords: keywordList,
          exclusions: form.exclusions.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      setMatchPreview(result);
    } catch (requestError) {
      setPreviewError(requestError instanceof ApiError ? requestError.message : tr("Moslikni tekshirib bo‘lmadi.", "Не удалось проверить совпадение.", "Could not check the match."));
    } finally {
      setPreviewing(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.media_scope === "selected" && selectedMediaIDs.length === 0) {
      setError(tr("Kamida bitta video yoki postni tanlang.", "Выберите хотя бы одно видео или публикацию.", "Select at least one video or post."));
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim() || `${form.keywords.split(",")[0]?.trim() || "Instagram"} → Direct`,
      instagram_account_id: form.instagram_account_id,
      match_mode: form.match_mode,
      keywords: form.keywords.split(",").map((value) => value.trim()).filter(Boolean),
      exclusions: form.exclusions.split(",").map((value) => value.trim()).filter(Boolean),
      media_scope: form.media_scope,
      media_ids: selectedMediaIDs,
      private_reply_text: form.private_reply_text,
      public_success_reply_text: form.public_success_reply_text,
      public_not_follower_reply_text: form.public_not_follower_reply_text,
      public_unknown_reply_text: form.public_unknown_reply_text,
      follow_verification_enabled: form.follow_verification_enabled,
      unknown_fallback_policy: form.unknown_fallback_policy,
      is_active: form.is_active,
      priority: Number(form.priority),
    };
    try {
      const creating = !id || copyMode;
      await api(creating ? "/automations" : `/automations/${id}`, { method: creating ? "POST" : "PATCH", ...jsonBody(payload) });
      router.push("/app/automations");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : tr("Qoida saqlanmadi", "Правило не сохранено", "Rule was not saved"));
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) return <ErrorState message={tr("Qoida yaratish yoki tahrirlash uchun Manager yoki Owner roli kerak.", "Для создания или изменения правила нужна роль Manager или Owner.", "Manager or Owner role is required to create or edit rules.")} retry={() => router.push("/app/automations")}/>;
  if (accounts.loading || existing.loading) return <LoadingState label={tr("Qoida muharriri yuklanmoqda...", "Редактор загружается...", "Loading rule editor...")}/>;
  if (accounts.error || existing.error) return <ErrorState message={accounts.error || existing.error} retry={() => { void accounts.reload(); void existing.reload(); }}/>;

  return <>
    <PageHeader eyebrow="Instagram comment → Direct" title={copyMode ? tr("Qoidadan nusxa", "Копия правила", "Copy automation") : id ? tr("Avtomatlashtirishni tahrirlash", "Редактирование автоматизации", "Edit automation") : tr("Yangi avtomatlashtirish", "Новая автоматизация", "New automation")} description={tr("Videoni tanlang, kalit so‘zni va ikki javob matnini kiriting.", "Выберите видео, добавьте ключевое слово и два текста ответа.", "Choose a video, add a keyword, and write both replies.")} action={<Link className="btn secondary" href="/app/automations"><ChevronLeft/>{tr("Orqaga", "Назад", "Back")}</Link>}/>
    {error && <div className="form-alert error">{error}</div>}
    {!connectedAccounts.length ? <section className="builder-connect panel">
      <div className="builder-connect-art" aria-hidden="true"><span className="builder-connect-orbit orbit-one"/><span className="builder-connect-orbit orbit-two"/><span className="builder-connect-instagram"><Instagram/></span><span className="builder-connect-check"><Check/></span></div>
      <div className="builder-connect-copy"><span className="builder-kicker">{tr("BIRINCHI QADAM", "ПЕРВЫЙ ШАГ", "FIRST STEP")}</span><h2>{tr("Instagram akkauntingizni ulang", "Подключите Instagram аккаунт", "Connect your Instagram account")}</h2><p>{tr("Rasmiy Meta oynasida Business yoki Creator akkauntingizni tasdiqlang. Keyin videoni tanlab, javob matnlarini yozasiz.", "Подтвердите Business или Creator аккаунт в официальном окне Meta. Затем выберите видео и напишите ответы.", "Confirm your Business or Creator account in Meta’s official window. Then choose a video and write your replies.")}</p><Link className="btn primary" href="/app/accounts"><Instagram/>{tr("Akkauntni ulash", "Подключить аккаунт", "Connect account")}</Link><div className="builder-security-note"><ShieldCheck/><span>{tr("Parol IDS Automate’ga kiritilmaydi. Ulash rasmiy Meta oynasida amalga oshadi.", "Пароль не вводится в IDS Automate. Подключение проходит в официальном окне Meta.", "Your password is never entered in IDS Automate. Connection happens in Meta’s official window.")}</span></div></div>
      <div className="builder-connect-steps"><div className="current"><span>01</span><div><strong>{tr("Akkauntni ulang", "Подключите аккаунт", "Connect account")}</strong><small>{tr("Rasmiy Meta orqali", "Через Meta", "Through Meta")}</small></div></div><i/><div><span>02</span><div><strong>{tr("Videoni tanlang", "Выберите видео", "Choose a video")}</strong><small>{tr("O‘z postlaringizdan", "Из своих публикаций", "From your posts")}</small></div></div><i/><div><span>03</span><div><strong>{tr("Javoblarni yozing", "Напишите ответы", "Write your replies")}</strong><small>{tr("Direct va comment uchun", "Для Direct и комментария", "For Direct and comments")}</small></div></div></div>
    </section> :
    <form className="automation-builder" onSubmit={submit}>
      <div className="builder-progress"><div className="current"><span>01</span>{tr("Video tanlang", "Выберите видео", "Choose a video")}</div><i/><div><span>02</span>{tr("Javoblarni yozing", "Напишите ответы", "Write your replies")}</div><i/><div><span>03</span>{tr("Saqlang va ishga tushiring", "Сохраните и запустите", "Save and activate")}</div></div>
      <div className="builder-columns"><div className="builder-main">
        <section className="panel builder-card">
          <div className="builder-card-heading"><span className="builder-step-number">01</span><div><h2>{tr("Qaysi videoga javob beramiz?", "На какое видео отвечать?", "Which video should trigger replies?")}</h2><p>{tr("O‘z Instagram postingizdan tanlang", "Выберите публикацию из своего Instagram", "Choose a post from your Instagram account")}</p></div></div>
          <div className="builder-account-row">{connectedAccounts.length > 1 || !selectedAccount ? <label className="builder-account-select"><span>{tr("Instagram akkaunti", "Instagram аккаунт", "Instagram account")}</span><SelectMenu value={form.instagram_account_id} onChange={selectAccount} ariaLabel={tr("Instagram akkauntni tanlang", "Выберите Instagram аккаунт", "Select Instagram account")} placeholder={tr("Akkauntni tanlang", "Выберите аккаунт", "Select account")} options={[{ value: "", label: tr("Akkauntni tanlang", "Выберите аккаунт", "Select account") }, ...connectedAccounts.map((account) => ({ value: account.id, label: "@" + account.username }))]}/></label> : <div className="builder-account-chip"><span><Instagram/></span><div><small>{tr("Ulangan akkaunt", "Подключённый аккаунт", "Connected account")}</small><strong>@{selectedAccount.username}</strong></div><CheckCircle2/></div>}<span className="builder-selection-count">{tr(selectedMediaIDs.length + " ta tanlandi", "Выбрано: " + selectedMediaIDs.length, selectedMediaIDs.length + " selected")}</span></div>
          {form.media_scope === "all" ? <div className="builder-all-media"><Images/><div><strong>{tr("Barcha postlar tanlangan", "Выбраны все публикации", "All posts are selected")}</strong><small>{tr("Hozirgi va yangi postlardagi mos kommentlar uchun.", "Для подходящих комментариев в текущих и новых публикациях.", "For matching comments on existing and future posts.")}</small></div></div> : <div className="media-picker builder-media-picker" aria-live="polite">
            <div className="media-picker-heading"><div><strong>{tr("Videolar va postlar", "Видео и публикации", "Videos and posts")}</strong><small>{tr("Bir yoki bir nechta postni tanlang", "Выберите одну или несколько публикаций", "Select one or more posts")}</small></div><button type="button" className="btn secondary small" onClick={() => void media.reload()} disabled={media.loading}><RefreshCw/>{tr("Yangilash", "Обновить", "Refresh")}</button></div>
            {media.loading ? <div className="media-picker-state"><span className="spinner"/>{tr("Instagram postlari yuklanmoqda...", "Загружаем публикации Instagram...", "Loading Instagram posts...")}</div> : media.error ? <div className="media-picker-state error"><AlertTriangle/><span>{media.error}</span><button type="button" className="btn secondary small" onClick={() => void media.reload()}>{tr("Qayta urinish", "Повторить", "Try again")}</button></div> : !media.data?.items.length ? <div className="builder-media-empty"><span><Film/></span><strong>{tr("Tanlash uchun post topilmadi", "Подходящие публикации не найдены", "No eligible posts found")}</strong><p>{tr("Postlaringiz bo‘lsa, ro‘yxatni yangilang yoki ulanish ruxsatlarini tekshiring.", "Если публикации есть, обновите список или проверьте разрешения подключения.", "If your account has posts, refresh the list or check its connection permissions.")}</p><button type="button" className="btn secondary small" onClick={() => void media.reload()}><RefreshCw/>{tr("Qayta yuklash", "Обновить список", "Reload posts")}</button></div> : <div className="media-grid builder-media-grid">{media.data.items.map((item) => {
              const selected = selectedMediaIDs.includes(item.id);
              const preview = item.thumbnail_url || (item.media_type === "IMAGE" || item.media_type === "CAROUSEL_ALBUM" ? item.media_url : "");
              const mediaLabel = item.media_product_type === "REELS" ? "Reels" : item.media_type === "VIDEO" ? tr("Video", "Видео", "Video") : tr("Post", "Публикация", "Post");
              return <article className={selected ? "media-card selected" : "media-card"} key={item.id}><button type="button" aria-pressed={selected} onClick={() => toggleMedia(item.id)}><span className="media-cover" style={preview ? { backgroundImage: "url(" + JSON.stringify(preview) + ")" } : undefined}>{!preview && <Film/>}<small>{mediaLabel}</small>{selected && <b><Check/></b>}</span><span className="media-copy"><strong>{item.caption?.trim() || tr("Matnsiz post", "Публикация без текста", "Post without a caption")}</strong><small>{item.timestamp ? new Date(item.timestamp).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ") : ""}</small></span></button>{item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" aria-label={tr("Instagram’da ochish", "Открыть в Instagram", "Open on Instagram")}><ExternalLink/></a>}</article>;
            })}</div>}
          </div>}
        </section>
        <section className="panel builder-card builder-replies-card">
          <div className="builder-card-heading"><span className="builder-step-number">02</span><div><h2>{tr("Javoblarni sozlang", "Настройте ответы", "Set up your replies")}</h2><p>{tr("Kalit so‘zga mos comment kelganda yuboriladigan matnlar", "Тексты для комментария с подходящим ключевым словом", "Replies sent when a comment matches your keyword")}</p></div></div>
          <label className="builder-name-field"><span>{tr("Qoida nomi", "Название правила", "Automation name")}</span><input value={form.name} onChange={(event) => field("name", event.target.value)} maxLength={120} placeholder={tr("Masalan: Reels — narx so‘rovlari", "Например: Reels — вопросы о цене", "For example: Reels — price questions")}/></label>
          <label className="builder-keyword-field"><span>{tr("Kalit so‘z", "Ключевое слово", "Keyword")}</span><input value={form.keywords} onChange={(event) => field("keywords", event.target.value)} required placeholder={tr("Masalan: narx, katalog", "Например: цена, каталог", "For example: price, catalog")}/><small>{tr("Bir nechta so‘zni vergul bilan ajrating.", "Разделяйте несколько слов запятыми.", "Separate multiple keywords with commas.")}</small></label>
          <section className="builder-match-preview" aria-live="polite">
            <div className="builder-match-preview-heading"><span><FlaskConical/><strong>{tr("Qoidani tekshirish", "Проверить правило", "Try this rule")}</strong></span><small>{tr("Haqiqiy backend moslik qoidasi ishlatiladi. Xabar yuborilmaydi.", "Используется реальная логика сопоставления backend. Сообщения не отправляются.", "Uses the backend matching logic. No message is sent.")}</small></div>
            <div className="builder-match-preview-controls"><textarea value={previewComment} onChange={(event) => { setPreviewComment(event.target.value); setMatchPreview(null); setPreviewError(""); }} maxLength={1000} rows={2} placeholder={tr("Sinov commentini yozing — masalan: Narxi qancha?", "Введите пример комментария — например: Сколько стоит?", "Enter a sample comment — for example: How much does it cost?")}/><button type="button" className="btn secondary" onClick={() => void runMatchPreview()} disabled={previewing}><FlaskConical/>{previewing ? tr("Tekshirilmoqda...", "Проверяем...", "Checking...") : tr("Tekshirish", "Проверить", "Check match")}</button></div>
            {previewError && <p className="builder-preview-error" role="alert">{previewError}</p>}
            {matchPreview && <div className={matchPreview.matched ? "builder-preview-result matched" : "builder-preview-result unmatched"} role="status"><strong>{matchPreview.matched ? tr("Kalit so‘z mos keldi", "Ключевое слово найдено", "Keyword matched") : tr("Mos kalit so‘z topilmadi", "Подходящее ключевое слово не найдено", "No keyword matched")}</strong>{matchPreview.matched && <span>{tr("Topilgan kalit so‘z", "Совпавшее слово", "Matched keyword")}: <b>{matchPreview.matched_keyword}</b></span>}<small>{tr("Normallashtirilgan comment", "Нормализованный комментарий", "Normalized comment")}: {matchPreview.normalized_comment || "—"}</small><small>{tr("Sinov rejimi: hech qanday Direct yoki comment yuborilmadi.", "Проверка: Direct и комментарий не отправлялись.", "Preview only: no Direct or public comment was sent.")}</small></div>}
          </section>
          <div className="builder-message-grid"><label><span>{tr("Direct xabari", "Сообщение в Direct", "Direct message")} <small>{form.private_reply_text.length}/1000</small></span><textarea value={form.private_reply_text} onChange={(event) => field("private_reply_text", event.target.value)} maxLength={1000} rows={5} required placeholder={tr("Mijozga yuboriladigan shaxsiy xabar...", "Личное сообщение клиенту...", "Private message sent to the customer...")}/><small>{tr("Shaxsiy javob comment yozgan odamga yuboriladi.", "Личный ответ отправляется автору комментария.", "This private reply goes to the commenter.")}</small></label><label><span>{tr("Comment ostidagi javob", "Ответ под комментарием", "Public comment reply")} <small>{form.public_success_reply_text.length}/1000</small></span><textarea value={form.public_success_reply_text} onChange={(event) => field("public_success_reply_text", event.target.value)} maxLength={1000} rows={5} required placeholder={tr("Masalan: Direct xabaringizga yubordik! 📩", "Например: Отправили вам в Direct! 📩", "For example: Sent you a Direct message! 📩")}/><small>{tr("Faqat Direct yuborilishi tasdiqlangach chiqadi.", "Публикуется только после подтверждения отправки Direct.", "Posted only after Meta confirms the Direct message.")}</small></label></div>
        </section>
        <details className="panel builder-advanced"><summary><span><strong>{tr("Qo‘shimcha sozlamalar", "Дополнительные настройки", "Additional settings")}</strong><small>{tr("Faqat kerak bo‘lsa o‘zgartiring", "Изменяйте при необходимости", "Change only if needed")}</small></span><span className="builder-advanced-chevron">⌄</span></summary><div className="builder-advanced-content">
          <div className="builder-advanced-row"><label><span>{tr("Moslik turi", "Тип совпадения", "Matching mode")}</span><div className="segmented">{[["contains", tr("Ichida bor", "Содержит", "Contains")], ["exact", tr("Aniq teng", "Точное совпадение", "Exact")], ["keyword_list", tr("Alohida so‘z", "Отдельное слово", "Whole word")]].map(([value, label]) => <button type="button" className={form.match_mode === value ? "active" : ""} onClick={() => field("match_mode", value)} key={value}>{label}</button>)}</div></label><label><span>{tr("Istisno so‘zlar", "Исключающие слова", "Exclude keywords")}</span><input value={form.exclusions} onChange={(event) => field("exclusions", event.target.value)} placeholder={tr("bepul, spam", "бесплатно, спам", "free, spam")}/></label></div>
          <button type="button" className="builder-text-action" onClick={() => selectMediaScope(form.media_scope === "all" ? "selected" : "all")}>{form.media_scope === "all" ? tr("Tanlangan videolarga qaytish", "Вернуться к выбору видео", "Choose specific videos") : tr("Barcha postlarda ishlatish", "Использовать для всех публикаций", "Use on all posts")}</button>
          <div className="builder-follow-settings"><div><strong>{tr("Obunani tekshirish", "Проверка подписки", "Follow verification")}</strong><small>{tr("Meta bu ma’lumotni qaytarmasa, holat UNKNOWN bo‘ladi.", "Если Meta не вернёт это поле, статус будет UNKNOWN.", "If Meta does not return this field, the result is UNKNOWN.")}</small></div><label className="builder-switch"><span className="sr-only">{tr("Follower holatini tekshirish", "Проверять подписку", "Verify follower status")}</span><input type="checkbox" checked={form.follow_verification_enabled} onChange={(event) => field("follow_verification_enabled", event.target.checked)}/><i/></label></div>
          {form.follow_verification_enabled && <div className="builder-follow-extra"><label><span>{tr("Holat noma’lum bo‘lsa", "Если статус неизвестен", "If the status is unknown")}</span><SelectMenu value={form.unknown_fallback_policy} onChange={(value) => field("unknown_fallback_policy", value)} ariaLabel={tr("Holat noma’lum bo‘lgandagi siyosat", "Поведение при неизвестном статусе", "Unknown status policy")} className="wide" options={[{ value: "skip_dm_neutral_reply", label: tr("Direct yubormaslik", "Не отправлять Direct", "Skip Direct"), description: tr("Neytral comment yozish", "Оставить нейтральный комментарий", "Post a neutral comment") }, { value: "send_private_reply", label: tr("Direct yuborish", "Отправить Direct", "Send Direct"), description: tr("Tekshiruvsiz", "Без проверки", "Without the check") }]}/></label><label><span>{tr("Obuna bo‘lmaganlar uchun javob", "Ответ для неподписанных", "Reply for non-followers")}</span><textarea value={form.public_not_follower_reply_text} onChange={(event) => field("public_not_follower_reply_text", event.target.value)} maxLength={1000} rows={2} required/></label><label><span>{tr("UNKNOWN holatidagi neytral javob", "Нейтральный ответ при UNKNOWN", "Neutral reply for UNKNOWN")}</span><textarea value={form.public_unknown_reply_text} onChange={(event) => field("public_unknown_reply_text", event.target.value)} maxLength={1000} rows={2} required/></label></div>}
        </div></details>
        <div className="builder-savebar"><label className="builder-active-toggle"><input type="checkbox" checked={form.is_active} onChange={(event) => field("is_active", event.target.checked)}/><span><strong>{tr("Saqlagach faollashtirish", "Активировать после сохранения", "Activate after saving")}</strong><small>{tr("Faqat yangi commentlar uchun", "Только для новых комментариев", "For new comments only")}</small></span></label><div><Link href="/app/automations" className="btn secondary">{tr("Bekor qilish", "Отмена", "Cancel")}</Link><button className="btn primary" disabled={saving}><Save/>{saving ? tr("Saqlanmoqda...", "Сохранение...", "Saving...") : tr("Saqlash", "Сохранить", "Save automation")}</button></div></div>
      </div><aside className="builder-side"><section className="panel builder-summary"><span className="builder-kicker">{tr("AVTOMATLASHTIRISH", "АВТОМАТИЗАЦИЯ", "AUTOMATION")}</span><h3>{tr("Oqim qanday ishlaydi", "Как работает сценарий", "How it works")}</h3><div className="builder-flow-list"><div><span className="builder-flow-icon video"><Film/></span><div><strong>{form.media_scope === "all" ? tr("Barcha postlar", "Все публикации", "All posts") : tr(selectedMediaIDs.length + " ta post", selectedMediaIDs.length + " публикаций", selectedMediaIDs.length + " posts")}</strong><small>{selectedAccount ? "@" + selectedAccount.username : tr("Akkaunt tanlanmagan", "Аккаунт не выбран", "No account selected")}</small></div></div>{selectedMediaItems.slice(0, 2).map((item) => <small className="builder-selected-title" key={item.id}>{item.caption?.trim() || tr("Matnsiz post", "Публикация без текста", "Post without a caption")}</small>)}<i/><div><span className="builder-flow-icon keyword"><MessageCircle/></span><div><strong>{tr("Kalit so‘z", "Ключевое слово", "Keyword")}</strong><small>{keywordList.join(", ") || tr("Kalit so‘z kiriting", "Введите ключевое слово", "Add a keyword")}</small></div></div><i/><div><span className="builder-flow-icon direct"><Send/></span><div><strong>{tr("Direct → comment", "Direct → comment", "Direct → comment")}</strong><small>{tr("Ommaviy javob DM tasdiqlangach chiqadi.", "Публичный ответ появится после подтверждения Direct.", "Public reply follows successful Direct delivery.")}</small></div></div></div><div className="builder-summary-foot"><ShieldCheck/><span>{tr("Comment bir marta qayta ishlanadi.", "Комментарий обрабатывается один раз.", "Each comment is processed once.")}</span></div></section></aside></div>
    </form>}
    {id && !copyMode && <ExecutionHistory data={history.data?.items} loading={history.loading} error={history.error} reload={history.reload}/>}
  </>;
}

function ExecutionHistory({ data, loading, error, reload }: { data?: AutomationExecution[]; loading: boolean; error: string; reload: () => Promise<void> }) {
  const { locale, tr } = usePreferences();
  if (loading) return <LoadingState label={tr("Bajarilish tarixi yuklanmoqda...", "История выполнения загружается...", "Loading execution history...")}/>;
  if (error) return <ErrorState message={error} retry={reload}/>;
  if (!data?.length) return <EmptyState title={tr("Hali bajarilish yo‘q", "Выполнений пока нет", "No executions yet")} text={tr("Real comment webhook kelgach har bir action natijasi shu yerda ko‘rinadi.", "После реального webhook комментария результаты действий появятся здесь.", "Action results will appear here after a real comment webhook arrives.")}/>;
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  return <section className="panel execution-history"><div className="panel-header"><div><h2><Clock3/> {tr("Bajarilish tarixi", "История выполнения", "Execution history")}</h2><p>{tr("Har bir operation alohida saqlanadi", "Каждая операция сохраняется отдельно", "Every operation is stored separately")}</p></div></div><div className="execution-list">{data.map((execution) => <article className="execution-row" key={execution.id}><div className="execution-heading"><div><strong>@{execution.username || "instagram-user"}</strong><span>{execution.comment_text || execution.comment_id}</span></div><StatusPill status={execution.status}/></div><div className="execution-meta"><span><UserCheck/> Follow: {execution.follow_status}</span><span><Clock3/> {new Date(execution.received_at).toLocaleString(dateLocale)}</span></div>{execution.error_message && <div className="form-alert error"><AlertTriangle/>{execution.error_code}: {execution.error_message}</div>}<div className="action-ledger">{execution.actions.map((action) => <div key={action.action_type}><span>{action.action_type === "follow_check" ? <CircleHelp/> : action.action_type === "private_reply" ? <Send/> : <MessageCircle/>}{action.action_type.replaceAll("_", " ")}</span><StatusPill status={action.status}/><small>{action.outcome || action.error_code || "—"}{action.attempt_count > 1 ? tr(` · ${action.attempt_count} urinish`, ` · ${action.attempt_count} попытки`, ` · ${action.attempt_count} attempts`) : ""}</small></div>)}</div></article>)}</div></section>;
}
