"use client";

import { AlertTriangle, ArrowRight, Bot, Check, CheckCircle2, ChevronLeft, CircleHelp, Clock3, ExternalLink, Film, Images, Eye, MessageCircle, RefreshCw, Save, Send, Sparkles, TestTube2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { Automation, AutomationExecution, InstagramAccount, InstagramMedia } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "./ui";
import { roleAtLeast, useSession } from "./session-context";
import { usePreferences } from "./preferences-provider";

const empty = {
  name: "",
  instagram_account_id: "",
  match_mode: "contains",
  keywords: "narx",
  exclusions: "",
  media_scope: "all",
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

function normalize(value: string) {
  return value.toLocaleLowerCase("uz").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().replace(/\s+/g, " ");
}

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
  const [test, setTest] = useState(() => tr("Narxi qancha?", "Сколько стоит?", "How much is it?"));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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
  const keywordList = form.keywords.split(",").map(normalize).filter(Boolean);
  const matched = (() => {
    const text = normalize(test);
    const excluded = form.exclusions.split(",").map(normalize).filter(Boolean).some((value) => text.includes(value));
    if (excluded) return false;
    return keywordList.some((value) => form.match_mode === "exact" ? text === value : form.match_mode === "keyword_list" ? text.split(" ").includes(value) : text.includes(value));
  })();

  function field(name: string, value: string | boolean | number) {
    setDraft({ ...form, [name]: value });
  }

  function selectAccount(accountID: string) {
    setDraft({ ...form, instagram_account_id: accountID, media_scope: "all", media_ids: "" });
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.media_scope === "selected" && selectedMediaIDs.length === 0) {
      setError(tr("Kamida bitta video yoki postni tanlang.", "Выберите хотя бы одно видео или публикацию.", "Select at least one video or post."));
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
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
    <PageHeader eyebrow={tr("Qoida muharriri", "Редактор правила", "Rule editor")} title={copyMode ? tr("Qoidadan nusxa yaratish", "Создать копию правила", "Copy automation") : id ? tr("Qoidani tahrirlash", "Редактировать правило", "Edit automation") : tr("Yangi avtomatlashtirish", "Новая автоматизация", "New automation")} description={tr("Har bir comment event faqat bir marta ishlanadi.", "Каждый комментарий обрабатывается только один раз.", "Each comment event is processed only once.")} action={<Link className="btn secondary" href="/app/automations"><ChevronLeft/>{tr("Orqaga", "Назад", "Back")}</Link>}/>
    {error && <div className="form-alert error">{error}</div>}
    {!connectedAccounts.length ? <div className="connect-first-card panel"><div className="connect-first-icon"><Images/></div><div><h2>{tr("Avval Instagram akkauntingizni ulang", "Сначала подключите свой Instagram", "Connect your Instagram first")}</h2><p>{tr("O‘z Professional akkauntingiz bilan rasmiy Instagram/Meta oynasida kirasiz. IDS Automate parolingizni ko‘rmaydi.", "Войдите в свой Professional аккаунт через официальное окно Instagram/Meta. IDS Automate не видит ваш пароль.", "Sign in to your Professional account in the official Instagram/Meta window. IDS Automate never sees your password.")}</p></div><Link className="btn primary" href="/app/accounts">{tr("Instagram bilan kirish", "Войти через Instagram", "Continue with Instagram")}</Link></div> :
      <form className="builder-layout" onSubmit={submit}>
        <div className="builder-form">
          <section className="panel form-section">
            <div className="form-section-title"><span>1</span><div><h2>{tr("Asosiy ma’lumot", "Основные данные", "Basics")}</h2><p>{tr("Qoida va akkauntni tanlang", "Выберите правило и аккаунт", "Choose the rule and account")}</p></div></div>
            <div className="form-grid">
              <label><span>{tr("Qoida nomi", "Название правила", "Rule name")}</span><input value={form.name} onChange={(event) => field("name", event.target.value)} required placeholder={tr("Masalan: Narx so‘rovi", "Например: Запрос цены", "For example: Price request")}/></label>
              <label><span>{tr("Instagram akkauntingiz", "Ваш Instagram аккаунт", "Your Instagram account")}</span><select value={form.instagram_account_id} onChange={(event) => selectAccount(event.target.value)} required><option value="">{tr("Akkauntni tanlang", "Выберите аккаунт", "Select account")}</option>{connectedAccounts.map((account) => <option value={account.id} key={account.id}>@{account.username}</option>)}</select></label>
            </div>
          </section>
          <section className="panel form-section">
            <div className="form-section-title"><span>2</span><div><h2>{tr("Trigger va shart", "Триггер и условие", "Trigger and condition")}</h2><p>{tr("Comment qachon mos kelishini belgilang", "Определите, когда комментарий совпадает", "Define when a comment matches")}</p></div></div>
            <label><span>Match mode</span><div className="segmented">{[["contains", tr("Ichida bor", "Содержит", "Contains")], ["exact", tr("Aniq teng", "Точное совпадение", "Exact")], ["keyword_list", tr("Alohida so‘z", "Отдельное слово", "Whole word")]].map(([value, label]) => <button type="button" className={form.match_mode === value ? "active" : ""} onClick={() => field("match_mode", value)} key={value}>{label}</button>)}</div></label>
            <div className="form-grid">
              <label><span>{tr("Kalit so‘zlar", "Ключевые слова", "Keywords")} <small>{tr("vergul bilan", "через запятую", "comma-separated")}</small></span><input value={form.keywords} onChange={(event) => field("keywords", event.target.value)} required placeholder={tr("narx, qancha, katalog", "цена, сколько, каталог", "price, cost, catalog")}/></label>
              <label><span>{tr("Istisnolar", "Исключения", "Exclusions")} <small>{tr("ixtiyoriy", "необязательно", "optional")}</small></span><input value={form.exclusions} onChange={(event) => field("exclusions", event.target.value)} placeholder={tr("bepul, spam", "бесплатно, спам", "free, spam")}/></label>
            </div>
            <div className="post-scope-field"><span>{tr("Qaysi videolarda ishlasin?", "Для каких видео это работает?", "Which videos should use this automation?")}</span><div className="scope-choice-grid"><button type="button" className={form.media_scope === "all" ? "active" : ""} onClick={() => selectMediaScope("all")}><Images/><span><strong>{tr("Barcha video va postlar", "Все видео и публикации", "All videos and posts")}</strong><small>{tr("Hozirgi va keyingi postlarda ishlaydi", "Работает для текущих и будущих публикаций", "Works on current and future posts")}</small></span>{form.media_scope === "all" && <CheckCircle2/>}</button><button type="button" className={form.media_scope === "selected" ? "active" : ""} onClick={() => selectMediaScope("selected")}><Film/><span><strong>{tr("Aniq videolarni tanlash", "Выбрать конкретные видео", "Choose specific videos")}</strong><small>{tr("Instagram’dan rasmlari bilan ko‘rsatiladi", "Показываются с обложками из Instagram", "Shown with Instagram thumbnails")}</small></span>{form.media_scope === "selected" && <CheckCircle2/>}</button></div></div>
            {form.media_scope === "selected" && <div className="media-picker" aria-live="polite">
              <div className="media-picker-heading"><div><strong>{tr("Instagram postlaringiz", "Ваши публикации Instagram", "Your Instagram posts")}</strong><small>{tr(`${selectedMediaIDs.length} ta tanlandi`, `Выбрано: ${selectedMediaIDs.length}`, `${selectedMediaIDs.length} selected`)}</small></div><button type="button" className="btn secondary small" onClick={() => void media.reload()} disabled={media.loading}><RefreshCw/>{tr("Yangilash", "Обновить", "Refresh")}</button></div>
              {media.loading ? <div className="media-picker-state"><span className="spinner"/>{tr("Postlar Instagram’dan olinmoqda...", "Загружаем публикации из Instagram...", "Loading posts from Instagram...")}</div> : media.error ? <div className="media-picker-state error"><AlertTriangle/><span>{media.error}</span><button type="button" className="btn secondary small" onClick={() => void media.reload()}>{tr("Qayta urinish", "Повторить", "Try again")}</button></div> : !media.data?.items.length ? <div className="media-picker-state"><Film/><span>{tr("Bu akkauntda tanlash mumkin bo‘lgan post topilmadi.", "В этом аккаунте нет доступных публикаций.", "No eligible posts were found for this account.")}</span></div> : <div className="media-grid">{media.data.items.map((item) => {
                const selected = selectedMediaIDs.includes(item.id);
                const preview = item.thumbnail_url || (item.media_type === "IMAGE" || item.media_type === "CAROUSEL_ALBUM" ? item.media_url : "");
                const label = item.media_product_type === "REELS" ? "Reels" : item.media_type === "VIDEO" ? tr("Video", "Видео", "Video") : tr("Post", "Публикация", "Post");
                return <article className={`media-card ${selected ? "selected" : ""}`} key={item.id}><button type="button" aria-pressed={selected} onClick={() => toggleMedia(item.id)}><span className="media-cover" style={preview ? { backgroundImage: `url(${JSON.stringify(preview)})` } : undefined}>{!preview && <Film/>}<small>{label}</small>{selected && <b><Check/></b>}</span><span className="media-copy"><strong>{item.caption?.trim() || tr("Matnsiz post", "Публикация без текста", "Post without a caption")}</strong><small>{item.timestamp ? new Date(item.timestamp).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ") : ""}</small></span></button>{item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" aria-label={tr("Instagram’da ochish", "Открыть в Instagram", "Open on Instagram")}><ExternalLink/></a>}</article>;
              })}</div>}
            </div>}
          </section>
          <section className="panel form-section">
            <div className="form-section-title"><span>3</span><div><h2>{tr("Follow tekshiruvi", "Проверка подписки", "Follow verification")}</h2><p>{tr("Faqat rasmiy Meta field mavjud bo‘lsa aniq natija olinadi", "Точный результат доступен только при наличии официального Meta field", "A definitive result is available only when the official Meta field is present")}</p></div></div>
            <label className="toggle-row"><div><strong>{tr("Follower holatini tekshirish", "Проверять статус подписчика", "Verify follower status")}</strong><small>{tr("Xato yoki field yo‘q bo‘lsa natija UNKNOWN bo‘ladi.", "При ошибке или отсутствии field результат будет UNKNOWN.", "Errors or missing fields result in UNKNOWN.")}</small></div><input type="checkbox" checked={form.follow_verification_enabled} onChange={(event) => field("follow_verification_enabled", event.target.checked)}/></label>
            {form.follow_verification_enabled && <>
              <label><span>UNKNOWN fallback</span><select value={form.unknown_fallback_policy} onChange={(event) => field("unknown_fallback_policy", event.target.value)}><option value="skip_dm_neutral_reply">{tr("DM yubormaslik va neutral public reply", "Не отправлять DM, оставить нейтральный ответ", "Skip DM and post a neutral reply")}</option><option value="send_private_reply">{tr("Follow tekshiruvisiz private reply yuborish", "Отправить private reply без проверки подписки", "Send private reply without follow verification")}</option></select></label>
              <label><span>{tr("Follower emas — public reply", "Не подписан — публичный ответ", "Not a follower — public reply")}</span><textarea value={form.public_not_follower_reply_text} onChange={(event) => field("public_not_follower_reply_text", event.target.value)} maxLength={1000} rows={3} required/></label>
              <label><span>UNKNOWN — {tr("neutral public reply", "нейтральный публичный ответ", "neutral public reply")}</span><textarea value={form.public_unknown_reply_text} onChange={(event) => field("public_unknown_reply_text", event.target.value)} maxLength={1000} rows={3} required/></label>
            </>}
          </section>
          <section className="panel form-section">
            <div className="form-section-title"><span>4</span><div><h2>{tr("Reply ketma-ketligi", "Последовательность ответов", "Reply sequence")}</h2><p>{tr("Public javob faqat DM tasdiqlangandan keyin chiqadi", "Публичный ответ отправляется только после подтверждения DM", "The public reply is sent only after DM confirmation")}</p></div></div>
            <label><span>{tr("Private DM matni", "Текст private DM", "Private DM message")} <small>{form.private_reply_text.length}/1000</small></span><textarea value={form.private_reply_text} onChange={(event) => field("private_reply_text", event.target.value)} maxLength={1000} rows={5} required/></label>
            <label><span>{tr("DM muvaffaqiyatli — public reply", "DM успешен — публичный ответ", "DM succeeded — public reply")} <small>{form.public_success_reply_text.length}/1000</small></span><textarea value={form.public_success_reply_text} onChange={(event) => field("public_success_reply_text", event.target.value)} maxLength={1000} rows={3} required/></label>
            <label className="toggle-row"><div><strong>{tr("Darhol faollashtirish", "Активировать сразу", "Activate immediately")}</strong><small>{tr("Saqlangandan keyin yangi eventlar uchun ishlaydi", "Начнёт работать для новых событий после сохранения", "Starts processing new events after saving")}</small></div><input type="checkbox" checked={form.is_active} onChange={(event) => field("is_active", event.target.checked)}/></label>
          </section>
          <div className="sticky-form-actions"><Link href="/app/automations" className="btn secondary">{tr("Bekor qilish", "Отмена", "Cancel")}</Link><button className="btn primary" disabled={saving}><Save/>{saving ? tr("Saqlanmoqda...", "Сохранение...", "Saving...") : tr("Qoidani saqlash", "Сохранить правило", "Save rule")}</button></div>
        </div>
        <aside className="builder-preview"><section className="panel">
          <div className="panel-header"><div><h2><Eye/> {tr("Jonli preview", "Предпросмотр", "Live preview")}</h2><p>{tr("Matching brauzerda simulyatsiya qilinadi", "Совпадение моделируется в браузере", "Matching is simulated in the browser")}</p></div></div>
          <div className="flow-preview"><div className="preview-node violet"><MessageCircle/><span><small>Trigger</small>Comment</span></div><ArrowRight/><div className={`preview-node ${matched ? "blue" : "muted"}`}><Sparkles/><span><small>Shart</small>{matched ? "Keyword" : "Mos emas"}</span></div><ArrowRight/>{form.follow_verification_enabled && <><div className={`preview-node ${matched ? "blue" : "muted"}`}><UserCheck/><span><small>Optional</small>Follow check</span></div><ArrowRight/></>}<div className={`preview-node ${matched ? "green" : "muted"}`}><Send/><span><small>Harakat</small>{matched ? "DM → public" : "To‘xtaydi"}</span></div></div>
          <label><span>{tr("Test comment", "Тестовый комментарий", "Test comment")}</span><div className="input-wrap"><TestTube2/><input value={test} onChange={(event) => setTest(event.target.value)}/></div></label>
          <div className={`match-result ${matched ? "success" : "neutral"}`}>{matched ? <><CheckCircle2/><span><strong>{tr("Qoida ishlaydi", "Правило сработает", "Rule matches")}</strong>{tr("Bir marta reply yuboriladi", "Ответ будет отправлен один раз", "A reply will be sent once")}</span></> : <><Bot/><span><strong>{tr("Qoida ishlamaydi", "Правило не сработает", "Rule does not match")}</strong>{tr("Kalit so‘z topilmadi", "Ключевое слово не найдено", "Keyword not found")}</span></>}</div>
          <div className="dm-preview"><div className="dm-user"><span>AZ</span><div><strong>aziza</strong><small>Instagram Direct</small></div></div><div className="dm-comment">{test || tr("Comment matni", "Текст комментария", "Comment text")}</div>{matched && <><div className="dm-bubble">{form.private_reply_text || "Private reply"}<small>{tr("DM Meta tomonidan tasdiqlangach", "После подтверждения DM Meta", "After Meta confirms the DM")}</small></div><div className="dm-bubble">{form.public_success_reply_text || "Public reply"}<small>Public comment reply</small></div></>}</div>
        </section></aside>
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
