"use client";

import Link from "next/link";
import { Bot, ChevronRight, Copy, MoreVertical, Pause, Play, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { roleAtLeast, useSession } from "@/components/session-context";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { Automation } from "@/lib/types";

export default function AutomationsPage() {
  const session = useSession();
  const canManage = roleAtLeast(session.user.role, "manager");
  const { data, loading, error, reload } = useApi<{ items: Automation[] }>("/automations");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  async function toggle(rule: Automation) {
    if (!canManage) return;
    setBusy(rule.id);
    setNotice("");
    try {
      await api(`/automations/${rule.id}`, { method: "PATCH", ...jsonBody({ is_active: !rule.is_active }) });
      await reload();
    } catch (requestError) {
      setNotice(requestError instanceof ApiError ? requestError.message : "Qoida yangilanmadi");
    } finally {
      setBusy("");
    }
  }

  async function remove(rule: Automation) {
    if (!canManage || !window.confirm(`“${rule.name}” qoidasini butunlay o‘chirasizmi?`)) return;
    setBusy(rule.id);
    setNotice("");
    try {
      await api(`/automations/${rule.id}`, { method: "DELETE" });
      await reload();
    } catch (requestError) {
      setNotice(requestError instanceof ApiError ? requestError.message : "Qoida o‘chmadi");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingState label="Qoidalar yuklanmoqda..."/>;
  if (error) return <ErrorState message={error} retry={reload}/>;
  const items = data?.items ?? [];

  return <>
    <PageHeader eyebrow="Real Comment → DM" title="Avtomatlashtirish qoidalari" description="Keyword, optional follow check, private DM va tasdiqlangan public reply ketma-ketligi." action={canManage ? <Link href="/app/automations/new" className="btn primary"><Plus/>Yangi qoida</Link> : undefined}/>
    {!canManage && <div className="notice-banner warning"><ShieldCheck/><span>Qoidalarni o‘zgartirish uchun Manager yoki Owner roli kerak. Sizda faqat ko‘rish huquqi mavjud.</span></div>}
    {notice && <div className="form-alert error">{notice}</div>}
    <div className="automation-summary"><div><strong>{items.length}</strong><span>Jami qoida</span></div><div><strong>{items.filter((item) => item.is_active).length}</strong><span>Faol</span></div><div><strong>{items.filter((item) => !item.is_active).length}</strong><span>Pauzada</span></div></div>
    {items.length === 0 ? <EmptyState title="Hali qoida yaratilmagan" text={canManage ? "Commentni aniqlab, bitta ruxsat etilgan Direct reply yuboruvchi oqim yarating." : "Manager yoki Owner birinchi qoidani yaratishi mumkin."} action={canManage ? <Link href="/app/automations/new" className="btn primary"><Plus/>Birinchi qoida</Link> : undefined}/> : <div className="automation-list">{items.map((rule) => <article className="automation-row" key={rule.id}>
      <span className="automation-icon"><Bot/></span>
      <div className="automation-main"><div><h3>{rule.name}</h3><StatusPill status={rule.is_active ? "active" : "paused"}/></div><p>@{rule.account_username} · {rule.match_mode} · <strong>{rule.keywords.join(", ")}</strong></p><div className="mini-flow"><span>Comment</span><ChevronRight/><span>Keyword</span>{rule.follow_verification_enabled && <><ChevronRight/><span>Follow check</span></>}<ChevronRight/><span>Private DM</span><ChevronRight/><span>Public reply</span></div></div>
      {canManage && <div className="automation-actions"><button className="icon-btn" title={rule.is_active ? "Pauza" : "Faollashtirish"} disabled={busy === rule.id} onClick={() => void toggle(rule)}>{rule.is_active ? <Pause/> : <Play/>}</button><Link className="icon-btn" title="Nusxa uchun ochish" href={`/app/automations/${rule.id}?copy=1`}><Copy/></Link><button className="icon-btn danger" title="O‘chirish" disabled={busy === rule.id} onClick={() => void remove(rule)}><Trash2/></button><Link className="icon-btn" title="Tahrirlash" href={`/app/automations/${rule.id}`}><MoreVertical/></Link></div>}
    </article>)}</div>}
  </>;
}
