"use client";

import { AlertTriangle, ArrowRight, Bot, CheckCircle2, ChevronLeft, CircleHelp, Clock3, Eye, MessageCircle, Save, Send, Sparkles, TestTube2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { Automation, AutomationExecution, InstagramAccount } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "./ui";
import { roleAtLeast, useSession } from "./session-context";

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
  const session = useSession();
  const canManage = roleAtLeast(session.user.role, "manager");
  const router = useRouter();
  const searchParams = useSearchParams();
  const accounts = useApi<{items: InstagramAccount[]}>("/instagram/accounts");
  const existing = useApi<Automation>(id ? `/automations/${id}` : null);
  const history = useApi<{items: AutomationExecution[]}>(id && !searchParams.has("copy") ? `/automations/${id}/executions` : null);
  const [draft, setDraft] = useState<typeof empty | null>(null);
  const [test, setTest] = useState("Narxi qancha?");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const copyMode = Boolean(id) && searchParams.has("copy");

  const initial = existing.data
    ? automationForm(existing.data)
    : { ...empty, instagram_account_id: !id ? (accounts.data?.items[0]?.id ?? "") : "" };
  const form = draft ?? initial;
  const keywordList = useMemo(() => form.keywords.split(",").map(normalize).filter(Boolean), [form.keywords]);
  const matched = useMemo(() => {
    const text = normalize(test);
    const excluded = form.exclusions.split(",").map(normalize).filter(Boolean).some((value) => text.includes(value));
    if (excluded) return false;
    return keywordList.some((value) => form.match_mode === "exact" ? text === value : form.match_mode === "keyword_list" ? text.split(" ").includes(value) : text.includes(value));
  }, [test, keywordList, form.match_mode, form.exclusions]);

  function field(name: string, value: string | boolean | number) {
    setDraft({ ...form, [name]: value });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      instagram_account_id: form.instagram_account_id,
      match_mode: form.match_mode,
      keywords: form.keywords.split(",").map((value) => value.trim()).filter(Boolean),
      exclusions: form.exclusions.split(",").map((value) => value.trim()).filter(Boolean),
      media_scope: form.media_scope,
      media_ids: form.media_ids.split(",").map((value) => value.trim()).filter(Boolean),
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
      setError(requestError instanceof ApiError ? requestError.message : "Qoida saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) return <ErrorState message="Qoida yaratish yoki tahrirlash uchun Manager yoki Owner roli kerak." retry={() => router.push("/app/automations")}/>;
  if (accounts.loading || existing.loading) return <LoadingState label="Qoida muharriri yuklanmoqda..."/>;
  if (accounts.error || existing.error) return <ErrorState message={accounts.error || existing.error} retry={() => { void accounts.reload(); void existing.reload(); }}/>;

  return <>
    <PageHeader eyebrow="Qoida muharriri" title={copyMode ? "Qoidadan nusxa yaratish" : id ? "Qoidani tahrirlash" : "Yangi avtomatlashtirish"} description="Har bir comment event faqat bir marta ishlanadi." action={<Link className="btn secondary" href="/app/automations"><ChevronLeft/>Orqaga</Link>}/>
    {error && <div className="form-alert error">{error}</div>}
    {!accounts.data?.items.length ? <div className="notice-banner warning">Avval Instagram akkaunt ulang. <Link href="/app/accounts">Akkauntlar sahifasi</Link></div> :
      <form className="builder-layout" onSubmit={submit}>
        <div className="builder-form">
          <section className="panel form-section">
            <div className="form-section-title"><span>1</span><div><h2>Asosiy ma’lumot</h2><p>Qoida va akkauntni tanlang</p></div></div>
            <div className="form-grid">
              <label><span>Qoida nomi</span><input value={form.name} onChange={(event) => field("name", event.target.value)} required placeholder="Masalan: Narx so‘rovi"/></label>
              <label><span>Instagram akkaunt</span><select value={form.instagram_account_id} onChange={(event) => field("instagram_account_id", event.target.value)} required><option value="">Tanlang</option>{accounts.data.items.filter((account) => account.status === "connected").map((account) => <option value={account.id} key={account.id}>@{account.username}</option>)}</select></label>
            </div>
          </section>
          <section className="panel form-section">
            <div className="form-section-title"><span>2</span><div><h2>Trigger va shart</h2><p>Comment qachon mos kelishini belgilang</p></div></div>
            <label><span>Match mode</span><div className="segmented">{[["contains", "Ichida bor"], ["exact", "Aniq teng"], ["keyword_list", "Alohida so‘z"]].map(([value, label]) => <button type="button" className={form.match_mode === value ? "active" : ""} onClick={() => field("match_mode", value)} key={value}>{label}</button>)}</div></label>
            <div className="form-grid">
              <label><span>Kalit so‘zlar <small>vergul bilan</small></span><input value={form.keywords} onChange={(event) => field("keywords", event.target.value)} required placeholder="narx, qancha, katalog"/></label>
              <label><span>Istisnolar <small>ixtiyoriy</small></span><input value={form.exclusions} onChange={(event) => field("exclusions", event.target.value)} placeholder="bepul, spam"/></label>
            </div>
            <label><span>Post scope</span><select value={form.media_scope} onChange={(event) => field("media_scope", event.target.value)}><option value="all">Barcha eligible media</option><option value="selected">Tanlangan media ID</option></select></label>
            {form.media_scope === "selected" && <label><span>Media ID’lar</span><input value={form.media_ids} onChange={(event) => field("media_ids", event.target.value)} placeholder="1789..., 1789..." required/></label>}
          </section>
          <section className="panel form-section">
            <div className="form-section-title"><span>3</span><div><h2>Follow tekshiruvi</h2><p>Faqat rasmiy Meta field mavjud bo‘lsa aniq natija olinadi</p></div></div>
            <label className="toggle-row"><div><strong>Follower holatini tekshirish</strong><small>Xato yoki field yo‘q bo‘lsa natija UNKNOWN bo‘ladi, NOT_FOLLOWER emas.</small></div><input type="checkbox" checked={form.follow_verification_enabled} onChange={(event) => field("follow_verification_enabled", event.target.checked)}/></label>
            {form.follow_verification_enabled && <>
              <label><span>UNKNOWN fallback</span><select value={form.unknown_fallback_policy} onChange={(event) => field("unknown_fallback_policy", event.target.value)}><option value="skip_dm_neutral_reply">DM yubormaslik va neutral public reply</option><option value="send_private_reply">Follow tekshiruvisiz private reply yuborish</option></select></label>
              <label><span>Follower emas — public reply</span><textarea value={form.public_not_follower_reply_text} onChange={(event) => field("public_not_follower_reply_text", event.target.value)} maxLength={1000} rows={3} required/></label>
              <label><span>UNKNOWN — neutral public reply</span><textarea value={form.public_unknown_reply_text} onChange={(event) => field("public_unknown_reply_text", event.target.value)} maxLength={1000} rows={3} required/></label>
            </>}
          </section>
          <section className="panel form-section">
            <div className="form-section-title"><span>4</span><div><h2>Reply ketma-ketligi</h2><p>Public muvaffaqiyat javobi faqat DM tasdiqlangandan keyin chiqadi</p></div></div>
            <label><span>Private DM matni <small>{form.private_reply_text.length}/1000</small></span><textarea value={form.private_reply_text} onChange={(event) => field("private_reply_text", event.target.value)} maxLength={1000} rows={5} required/></label>
            <label><span>DM muvaffaqiyatli — public reply <small>{form.public_success_reply_text.length}/1000</small></span><textarea value={form.public_success_reply_text} onChange={(event) => field("public_success_reply_text", event.target.value)} maxLength={1000} rows={3} required/></label>
            <label className="toggle-row"><div><strong>Darhol faollashtirish</strong><small>Saqlangandan keyin yangi eventlar uchun ishlaydi</small></div><input type="checkbox" checked={form.is_active} onChange={(event) => field("is_active", event.target.checked)}/></label>
          </section>
          <div className="sticky-form-actions"><Link href="/app/automations" className="btn secondary">Bekor qilish</Link><button className="btn primary" disabled={saving}><Save/>{saving ? "Saqlanmoqda..." : "Qoidani saqlash"}</button></div>
        </div>
        <aside className="builder-preview"><section className="panel">
          <div className="panel-header"><div><h2><Eye/> Jonli preview</h2><p>Matching brauzerda simulyatsiya qilinadi</p></div></div>
          <div className="flow-preview"><div className="preview-node violet"><MessageCircle/><span><small>Trigger</small>Comment</span></div><ArrowRight/><div className={`preview-node ${matched ? "blue" : "muted"}`}><Sparkles/><span><small>Shart</small>{matched ? "Keyword" : "Mos emas"}</span></div><ArrowRight/>{form.follow_verification_enabled && <><div className={`preview-node ${matched ? "blue" : "muted"}`}><UserCheck/><span><small>Optional</small>Follow check</span></div><ArrowRight/></>}<div className={`preview-node ${matched ? "green" : "muted"}`}><Send/><span><small>Harakat</small>{matched ? "DM → public" : "To‘xtaydi"}</span></div></div>
          <label><span>Test comment</span><div className="input-wrap"><TestTube2/><input value={test} onChange={(event) => setTest(event.target.value)}/></div></label>
          <div className={`match-result ${matched ? "success" : "neutral"}`}>{matched ? <><CheckCircle2/><span><strong>Qoida ishlaydi</strong>Bir marta reply yuboriladi</span></> : <><Bot/><span><strong>Qoida ishlamaydi</strong>Kalit so‘z topilmadi</span></>}</div>
          <div className="dm-preview"><div className="dm-user"><span>AZ</span><div><strong>aziza</strong><small>Instagram Direct</small></div></div><div className="dm-comment">{test || "Comment matni"}</div>{matched && <><div className="dm-bubble">{form.private_reply_text || "Private reply"}<small>DM Meta tomonidan tasdiqlangach</small></div><div className="dm-bubble">{form.public_success_reply_text || "Public reply"}<small>Public comment reply</small></div></>}</div>
        </section></aside>
      </form>}
    {id && !copyMode && <ExecutionHistory data={history.data?.items} loading={history.loading} error={history.error} reload={history.reload}/>}
  </>;
}

function ExecutionHistory({ data, loading, error, reload }: { data?: AutomationExecution[]; loading: boolean; error: string; reload: () => Promise<void> }) {
  if (loading) return <LoadingState label="Execution history yuklanmoqda..."/>;
  if (error) return <ErrorState message={error} retry={reload}/>;
  if (!data?.length) return <EmptyState title="Hali execution yo‘q" text="Real comment webhook kelgach har bir follow check, private reply va public reply natijasi shu yerda ko‘rinadi."/>;
  return <section className="panel execution-history"><div className="panel-header"><div><h2><Clock3/> Execution history</h2><p>Har bir operation alohida saqlanadi</p></div></div><div className="execution-list">{data.map((execution) => <article className="execution-row" key={execution.id}><div className="execution-heading"><div><strong>@{execution.username || "instagram-user"}</strong><span>{execution.comment_text || execution.comment_id}</span></div><StatusPill status={execution.status}/></div><div className="execution-meta"><span><UserCheck/> Follow: {execution.follow_status}</span><span><Clock3/> {new Date(execution.received_at).toLocaleString("uz-UZ")}</span></div>{execution.error_message && <div className="form-alert error"><AlertTriangle/>{execution.error_code}: {execution.error_message}</div>}<div className="action-ledger">{execution.actions.map((action) => <div key={action.action_type}><span>{action.action_type === "follow_check" ? <CircleHelp/> : action.action_type === "private_reply" ? <Send/> : <MessageCircle/>}{action.action_type.replaceAll("_", " ")}</span><StatusPill status={action.status}/><small>{action.outcome || action.error_code || "—"}{action.attempt_count > 1 ? ` · ${action.attempt_count} urinish` : ""}</small></div>)}</div></article>)}</div></section>;
}
