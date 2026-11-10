"use client";

import Link from "next/link";
import { Bot, ChevronRight, Copy, MoreVertical, Pause, Play, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { roleAtLeast, useSession } from "@/components/session-context";
import { usePreferences } from "@/components/preferences-provider";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { Automation } from "@/lib/types";

export default function AutomationsPage() {
  const { tr } = usePreferences();
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
      setNotice(requestError instanceof ApiError ? requestError.message : tr("Qoida yangilanmadi", "Правило не обновлено", "Rule was not updated"));
    } finally {
      setBusy("");
    }
  }

  async function remove(rule: Automation) {
    if (!canManage || !window.confirm(tr(`“${rule.name}” qoidasini butunlay o‘chirasizmi?`, `Удалить правило «${rule.name}»?`, `Permanently delete “${rule.name}”?`))) return;
    setBusy(rule.id);
    setNotice("");
    try {
      await api(`/automations/${rule.id}`, { method: "DELETE" });
      await reload();
    } catch (requestError) {
      setNotice(requestError instanceof ApiError ? requestError.message : tr("Qoida o‘chmadi", "Правило не удалено", "Rule was not deleted"));
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingState label={tr("Qoidalar yuklanmoqda...", "Правила загружаются...", "Loading rules...")}/>;
  if (error) return <ErrorState message={error} retry={reload}/>;
  const items = data?.items ?? [];

  return <>
    <PageHeader eyebrow="Real Comment → DM" title={tr("Avtomatlashtirish qoidalari", "Правила автоматизации", "Automation rules")} description={tr("Keyword, optional follow check, private DM va tasdiqlangan public reply ketma-ketligi.", "Ключевое слово, проверка подписки, private DM и подтверждённый публичный ответ.", "Keyword, optional follow check, private DM, and confirmed public reply ordering.")} action={canManage ? <Link href="/app/automations/new" className="btn primary"><Plus/>{tr("Yangi qoida", "Новое правило", "New rule")}</Link> : undefined}/>
    {!canManage && <div className="notice-banner warning"><ShieldCheck/><span>{tr("Qoidalarni o‘zgartirish uchun Manager yoki Owner roli kerak.", "Для изменения правил нужна роль Manager или Owner.", "Manager or Owner role is required to change rules.")}</span></div>}
    {notice && <div className="form-alert error">{notice}</div>}
    <div className="automation-summary"><div><strong>{items.length}</strong><span>{tr("Jami qoida", "Всего правил", "Total rules")}</span></div><div><strong>{items.filter((item) => item.is_active).length}</strong><span>{tr("Faol", "Активные", "Active")}</span></div><div><strong>{items.filter((item) => !item.is_active).length}</strong><span>{tr("Pauzada", "На паузе", "Paused")}</span></div></div>
    {items.length === 0 ? <EmptyState title={tr("Hali qoida yaratilmagan", "Правил пока нет", "No rules yet")} text={canManage ? tr("Birinchi Comment-to-DM oqimini yarating.", "Создайте первый Comment-to-DM поток.", "Create your first Comment-to-DM flow.") : tr("Manager yoki Owner birinchi qoidani yaratishi mumkin.", "Первое правило может создать Manager или Owner.", "A Manager or Owner can create the first rule.")} action={canManage ? <Link href="/app/automations/new" className="btn primary"><Plus/>{tr("Birinchi qoida", "Первое правило", "First rule")}</Link> : undefined}/> : <div className="automation-list">{items.map((rule) => <article className="automation-row" key={rule.id}>
      <span className="automation-icon"><Bot/></span>
      <div className="automation-main"><div><h3>{rule.name}</h3><StatusPill status={rule.is_active ? "active" : "paused"}/></div><p>@{rule.account_username} · {rule.match_mode} · <strong>{rule.keywords.join(", ")}</strong></p><div className="mini-flow"><span>Comment</span><ChevronRight/><span>Keyword</span>{rule.follow_verification_enabled && <><ChevronRight/><span>Follow check</span></>}<ChevronRight/><span>Private DM</span><ChevronRight/><span>Public reply</span></div></div>
      {canManage && <div className="automation-actions"><button className="icon-btn" title={rule.is_active ? tr("Pauza", "Пауза", "Pause") : tr("Faollashtirish", "Активировать", "Activate")} disabled={busy === rule.id} onClick={() => void toggle(rule)}>{rule.is_active ? <Pause/> : <Play/>}</button><Link className="icon-btn" title={tr("Nusxa yaratish", "Создать копию", "Create a copy")} href={`/app/automations/${rule.id}?copy=1`}><Copy/></Link><button className="icon-btn danger" title={tr("O‘chirish", "Удалить", "Delete")} disabled={busy === rule.id} onClick={() => void remove(rule)}><Trash2/></button><Link className="icon-btn" title={tr("Tahrirlash", "Редактировать", "Edit")} href={`/app/automations/${rule.id}`}><MoreVertical/></Link></div>}
    </article>)}</div>}
  </>;
}
