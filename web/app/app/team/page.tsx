"use client";

import { Copy, Mail, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Member } from "@/lib/types";
import { usePreferences } from "@/components/preferences-provider";

type Invitation = { id: string; email: string; role: string; expires_at: string; created_at: string };

export default function TeamPage() {
  const { tr } = usePreferences();
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
      setNotice(requestError instanceof ApiError ? requestError.message : tr("Taklif yaratilmadi", "Приглашение не создано", "Invitation was not created"));
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
      setNotice(tr(`${member.name} roli yangilandi`, `Роль ${member.name} обновлена`, `${member.name}'s role was updated`));
      await team.reload();
    } catch (requestError) {
      setNoticeKind("error");
      setNotice(requestError instanceof ApiError ? requestError.message : tr("Rol yangilanmadi", "Роль не обновлена", "Role was not updated"));
    } finally {
      setBusy("");
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(tr(`${member.name} workspace’dan olib tashlansinmi?`, `Удалить ${member.name} из workspace?`, `Remove ${member.name} from the workspace?`))) return;
    setBusy(member.id);
    setNotice("");
    try {
      await api(`/team/members/${member.id}`, { method: "DELETE" });
      setNoticeKind("success");
      setNotice(tr(`${member.name} workspace’dan olib tashlandi`, `${member.name} удалён из workspace`, `${member.name} was removed from the workspace`));
      await team.reload();
    } catch (requestError) {
      setNoticeKind("error");
      setNotice(requestError instanceof ApiError ? requestError.message : tr("A’zo olib tashlanmadi", "Участник не удалён", "Member was not removed"));
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
      setNotice(tr(`${invitation.email} uchun taklif bekor qilindi`, `Приглашение для ${invitation.email} отменено`, `Invitation for ${invitation.email} was canceled`));
      await team.reload();
    } catch (requestError) {
      setNoticeKind("error");
      setNotice(requestError instanceof ApiError ? requestError.message : tr("Taklif bekor qilinmadi", "Приглашение не отменено", "Invitation was not canceled"));
    } finally {
      setBusy("");
    }
  }

  if (team.loading) return <LoadingState label={tr("Jamoa yuklanmoqda...", "Команда загружается...", "Loading team...")}/>;
  if (team.error) return <ErrorState message={team.error} retry={team.reload}/>;

  return <>
    <PageHeader
      eyebrow="RBAC"
      title={tr("Jamoa", "Команда", "Team")}
      description={tr("Owner, Manager, Operator va Customer rollari backend’da tekshiriladi.", "Роли Owner, Manager, Operator и Customer проверяются на backend.", "Owner, Manager, Operator, and Customer roles are enforced by the backend.")}
      action={isOwner ? <button className="btn primary" onClick={() => setOpen(!open)}><UserPlus/>{tr("A’zo taklif qilish", "Пригласить участника", "Invite member")}</button> : undefined}
    />
    {notice && <div className={`form-alert ${noticeKind}`}>{notice}{token && <button type="button" className="copy-token" onClick={() => void navigator.clipboard.writeText(token)}><Copy/> {tr("Development tokenni nusxalash", "Копировать development token", "Copy development token")}</button>}</div>}
    {isOwner && open && <form className="panel invite-form" onSubmit={invite}>
      <div><h2>{tr("Yangi taklif", "Новое приглашение", "New invitation")}</h2><p>{tr("Taklif 7 kun amal qiladi.", "Приглашение действительно 7 дней.", "The invitation is valid for 7 days.")}</p></div>
      <label><span>Email</span><div className="input-wrap"><Mail/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="hamkasb@kompaniya.uz"/></div></label>
      <label><span>{tr("Rol", "Роль", "Role")}</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="manager">Manager</option><option value="operator">Operator</option><option value="customer">Customer</option></select></label>
      <button className="btn primary" disabled={busy === "invite"}><Plus/>{busy === "invite" ? tr("Yaratilmoqda...", "Создание...", "Creating...") : tr("Taklif yaratish", "Создать приглашение", "Create invitation")}</button>
    </form>}
    <section className="panel team-panel">
      <div className="panel-header"><div><h2>{tr("Workspace a’zolari", "Участники workspace", "Workspace members")}</h2><p>{team.data?.items.length ?? 0} {tr("ta faol a’zo", "активных участников", "active members")}</p></div><span className="summary-icon"><Users/></span></div>
      {team.data?.items.length ? <div className="responsive-table">
        <div className="table-head"><span>{tr("A’zo", "Участник", "Member")}</span><span>{tr("Rol", "Роль", "Role")}</span><span>{tr("Qo‘shilgan", "Добавлен", "Joined")}</span><span>{tr("Amal", "Действие", "Action")}</span></div>
        {team.data.items.map((member) => <div className="table-row" key={member.id}>
          <span className="member-cell"><b className="avatar">{member.name.slice(0, 2).toUpperCase()}</b><span><strong>{member.name}</strong><small>{member.email}</small></span></span>
          <span>{isOwner && member.role !== "owner" ? <select aria-label={`${member.name} roli`} value={member.role} disabled={busy === member.id} onChange={(event) => void updateRole(member, event.target.value)}><option value="manager">Manager</option><option value="operator">Operator</option><option value="customer">Customer</option></select> : <StatusPill status={member.role}/>}</span>
          <span>{formatDate(member.created_at)}</span>
          <span>{isOwner && member.role !== "owner" ? <button className="btn danger ghost small" disabled={busy === member.id} onClick={() => void removeMember(member)}><Trash2/>{tr("Olib tashlash", "Удалить", "Remove")}</button> : <StatusPill status="active"/>}</span>
        </div>)}
      </div> : <EmptyState title={tr("A’zolar yo‘q", "Участников нет", "No members")} text={tr("Workspace egasi avtomatik qo‘shiladi.", "Владелец workspace добавляется автоматически.", "The workspace owner is added automatically.")}/>}
    </section>
    {Boolean(team.data?.invitations.length) && <section className="panel">
      <div className="panel-header"><div><h2>{tr("Kutilayotgan takliflar", "Ожидающие приглашения", "Pending invitations")}</h2><p>{tr("Qabul qilinmagan", "Ещё не приняты", "Not yet accepted")}</p></div></div>
      <div className="simple-list">{team.data?.invitations.map((invitation) => <div className="list-row" key={invitation.id}><span className="row-icon"><Mail/></span><div><strong>{invitation.email}</strong><small>{invitation.role} · {tr(`${formatDate(invitation.expires_at)} gacha`, `до ${formatDate(invitation.expires_at)}`, `until ${formatDate(invitation.expires_at)}`)}</small></div>{isOwner ? <button className="btn danger ghost small" disabled={busy === invitation.id} onClick={() => void cancelInvitation(invitation)}><Trash2/>{tr("Bekor qilish", "Отменить", "Cancel")}</button> : <StatusPill status="pending"/>}</div>)}</div>
    </section>}
  </>;
}
