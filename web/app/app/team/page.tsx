"use client";

import { Copy, Mail, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Member } from "@/lib/types";

type Invitation = { id: string; email: string; role: string; expires_at: string; created_at: string };

export default function TeamPage() {
  const session = useSession();
  const isOwner = session.user.role === "owner";
  const team = useApi<{ items: Member[]; invitations: Invitation[] }>("/team");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error">("success");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState("");

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy("invite");
    setNotice("");
    try {
      const result = await api<{ message: string; dev_invitation_token?: string }>("/team/invitations", {
        method: "POST",
        ...jsonBody({ email, role }),
      });
      setNoticeKind("success");
      setNotice(result.message);
      setToken(result.dev_invitation_token ?? "");
      setEmail("");
      await team.reload();
    } catch (requestError) {
      setNoticeKind("error");
      setNotice(requestError instanceof ApiError ? requestError.message : "Taklif yaratilmadi");
    } finally {
      setBusy("");
    }
  }

  async function updateRole(member: Member, nextRole: string) {
    if (member.role === nextRole || member.role === "owner") return;
    setBusy(member.id);
    setNotice("");
    try {
      await api(`/team/members/${member.id}`, { method: "PATCH", ...jsonBody({ role: nextRole }) });
      setNoticeKind("success");
      setNotice(`${member.name} roli yangilandi`);
      await team.reload();
    } catch (requestError) {
      setNoticeKind("error");
      setNotice(requestError instanceof ApiError ? requestError.message : "Rol yangilanmadi");
    } finally {
      setBusy("");
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`${member.name} workspace’dan olib tashlansinmi?`)) return;
    setBusy(member.id);
    setNotice("");
    try {
      await api(`/team/members/${member.id}`, { method: "DELETE" });
      setNoticeKind("success");
      setNotice(`${member.name} workspace’dan olib tashlandi`);
      await team.reload();
    } catch (requestError) {
      setNoticeKind("error");
      setNotice(requestError instanceof ApiError ? requestError.message : "A’zo olib tashlanmadi");
    } finally {
      setBusy("");
    }
  }

  async function cancelInvitation(invitation: Invitation) {
    setBusy(invitation.id);
    setNotice("");
    try {
      await api(`/team/invitations/${invitation.id}`, { method: "DELETE" });
      setNoticeKind("success");
      setNotice(`${invitation.email} uchun taklif bekor qilindi`);
      await team.reload();
    } catch (requestError) {
      setNoticeKind("error");
      setNotice(requestError instanceof ApiError ? requestError.message : "Taklif bekor qilinmadi");
    } finally {
      setBusy("");
    }
  }

  if (team.loading) return <LoadingState label="Jamoa yuklanmoqda..."/>;
  if (team.error) return <ErrorState message={team.error} retry={team.reload}/>;

  return <>
    <PageHeader
      eyebrow="RBAC"
      title="Jamoa"
      description="Owner, Manager, Operator va Customer rollari backend’da tekshiriladi."
      action={isOwner ? <button className="btn primary" onClick={() => setOpen(!open)}><UserPlus/>A’zo taklif qilish</button> : undefined}
    />
    {notice && <div className={`form-alert ${noticeKind}`}>{notice}{token && <button type="button" className="copy-token" onClick={() => void navigator.clipboard.writeText(token)}><Copy/> Development tokenni nusxalash</button>}</div>}
    {isOwner && open && <form className="panel invite-form" onSubmit={invite}>
      <div><h2>Yangi taklif</h2><p>Taklif 7 kun amal qiladi.</p></div>
      <label><span>Email</span><div className="input-wrap"><Mail/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="hamkasb@kompaniya.uz"/></div></label>
      <label><span>Rol</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="manager">Manager</option><option value="operator">Operator</option><option value="customer">Customer</option></select></label>
      <button className="btn primary" disabled={busy === "invite"}><Plus/>{busy === "invite" ? "Yaratilmoqda..." : "Taklif yaratish"}</button>
    </form>}
    <section className="panel team-panel">
      <div className="panel-header"><div><h2>Workspace a’zolari</h2><p>{team.data?.items.length ?? 0} ta faol a’zo</p></div><span className="summary-icon"><Users/></span></div>
      {team.data?.items.length ? <div className="responsive-table">
        <div className="table-head"><span>A’zo</span><span>Rol</span><span>Qo‘shilgan</span><span>Amal</span></div>
        {team.data.items.map((member) => <div className="table-row" key={member.id}>
          <span className="member-cell"><b className="avatar">{member.name.slice(0, 2).toUpperCase()}</b><span><strong>{member.name}</strong><small>{member.email}</small></span></span>
          <span>{isOwner && member.role !== "owner" ? <select aria-label={`${member.name} roli`} value={member.role} disabled={busy === member.id} onChange={(event) => void updateRole(member, event.target.value)}><option value="manager">Manager</option><option value="operator">Operator</option><option value="customer">Customer</option></select> : <StatusPill status={member.role}/>}</span>
          <span>{formatDate(member.created_at)}</span>
          <span>{isOwner && member.role !== "owner" ? <button className="btn danger ghost small" disabled={busy === member.id} onClick={() => void removeMember(member)}><Trash2/>Olib tashlash</button> : <StatusPill status="active"/>}</span>
        </div>)}
      </div> : <EmptyState title="A’zolar yo‘q" text="Workspace egasi avtomatik qo‘shiladi."/>}
    </section>
    {Boolean(team.data?.invitations.length) && <section className="panel">
      <div className="panel-header"><div><h2>Kutilayotgan takliflar</h2><p>Qabul qilinmagan</p></div></div>
      <div className="simple-list">{team.data?.invitations.map((invitation) => <div className="list-row" key={invitation.id}><span className="row-icon"><Mail/></span><div><strong>{invitation.email}</strong><small>{invitation.role} · {formatDate(invitation.expires_at)} gacha</small></div>{isOwner ? <button className="btn danger ghost small" disabled={busy === invitation.id} onClick={() => void cancelInvitation(invitation)}><Trash2/>Bekor qilish</button> : <StatusPill status="pending"/>}</div>)}</div>
    </section>}
  </>;
}
