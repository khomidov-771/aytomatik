"use client";

import { ArrowRight, Bot, CheckCircle2, ChevronLeft, Eye, MessageCircle, Save, Send, Sparkles, TestTube2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { Automation, InstagramAccount } from "@/lib/types";
import { DemoBadge, ErrorState, LoadingState, PageHeader } from "./ui";
import { roleAtLeast, useSession } from "./session-context";

const empty = {
  name: "",
  instagram_account_id: "",
  match_mode: "contains",
  keywords: "narx",
  exclusions: "",
  media_scope: "all",
  media_ids: "",
  reply_text: "Assalomu alaykum! Batafsil ma’lumotni ushbu havolada ko‘rishingiz mumkin:",
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
    reply_text: automation.reply_text,
    is_active: automation.is_active,
    priority: automation.priority,
  };
}

export function AutomationForm({ id }: { id?: string }) {
  const session = useSession();
  const canManage = roleAtLeast(session.user.role, "manager");
  const router = useRouter();
  const searchParams = useSearchParams();
  const accounts = useApi<{items: InstagramAccount[]; demo_mode: boolean}>("/instagram/accounts");
  const existing = useApi<Automation>(id ? `/automations/${id}` : null);
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
      reply_text: form.reply_text,
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
    {accounts.data?.demo_mode && <div className="notice-banner demo"><DemoBadge/><span>Test eventlar haqiqiy Instagram’ga yuborilmaydi.</span></div>}
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
            <div className="form-section-title"><span>3</span><div><h2>Private reply</h2><p>Policy ruxsat bergan bitta xabar</p></div></div>
            <label><span>Javob matni <small>{form.reply_text.length}/1000</small></span><textarea value={form.reply_text} onChange={(event) => field("reply_text", event.target.value)} maxLength={1000} rows={5} required/></label>
            <label className="toggle-row"><div><strong>Darhol faollashtirish</strong><small>Saqlangandan keyin yangi eventlar uchun ishlaydi</small></div><input type="checkbox" checked={form.is_active} onChange={(event) => field("is_active", event.target.checked)}/></label>
          </section>
          <div className="sticky-form-actions"><Link href="/app/automations" className="btn secondary">Bekor qilish</Link><button className="btn primary" disabled={saving}><Save/>{saving ? "Saqlanmoqda..." : "Qoidani saqlash"}</button></div>
        </div>
        <aside className="builder-preview"><section className="panel">
          <div className="panel-header"><div><h2><Eye/> Jonli preview</h2><p>Matching brauzerda simulyatsiya qilinadi</p></div></div>
          <div className="flow-preview"><div className="preview-node violet"><MessageCircle/><span><small>Trigger</small>Yangi comment</span></div><ArrowRight/><div className={`preview-node ${matched ? "blue" : "muted"}`}><Sparkles/><span><small>Shart</small>{matched ? "Mos keldi" : "Mos kelmadi"}</span></div><ArrowRight/><div className={`preview-node ${matched ? "green" : "muted"}`}><Send/><span><small>Harakat</small>{matched ? "Private reply" : "Yuborilmaydi"}</span></div></div>
          <label><span>Test comment</span><div className="input-wrap"><TestTube2/><input value={test} onChange={(event) => setTest(event.target.value)}/></div></label>
          <div className={`match-result ${matched ? "success" : "neutral"}`}>{matched ? <><CheckCircle2/><span><strong>Qoida ishlaydi</strong>Bir marta reply yuboriladi</span></> : <><Bot/><span><strong>Qoida ishlamaydi</strong>Kalit so‘z topilmadi</span></>}</div>
          <div className="dm-preview"><div className="dm-user"><span>AZ</span><div><strong>aziza</strong><small>Instagram Direct</small></div></div><div className="dm-comment">{test || "Comment matni"}</div>{matched && <div className="dm-bubble">{form.reply_text || "Reply matni"}<small>Demo preview</small></div>}</div>
        </section></aside>
      </form>}
  </>;
}
