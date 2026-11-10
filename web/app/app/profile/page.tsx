"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Settings, ShieldCheck, Trash2, User } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Session } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { usePreferences } from "@/components/preferences-provider";

type SessionInfo = {
  id: string;
  workspace_name: string;
  current: boolean;
  last_seen_at: string;
  expires_at: string;
  created_at: string;
};

export default function ProfilePage() {
  const { tr } = usePreferences();
  const router = useRouter();
  const profile = useApi<Session>("/me");
  const sessions = useApi<{items: SessionInfo[]}>("/sessions");

  async function revoke(item: SessionInfo) {
    await api(`/sessions/${item.id}`, { method: "DELETE" });
    if (item.current) {
      router.push("/login");
      return;
    }
    await sessions.reload();
  }

  if (profile.loading) return <LoadingState/>;
  if (profile.error || !profile.data) return <ErrorState message={profile.error || tr("Profil topilmadi", "Профиль не найден", "Profile not found")} retry={profile.reload}/>;
  const user = profile.data.user;

  return <>
    <PageHeader eyebrow={tr("Hisob", "Аккаунт", "Account")} title={tr("Profil", "Профиль", "Profile")} description={tr("Shaxsiy ma’lumot, workspace roli va faol sessiyalar.", "Личные данные, роль workspace и активные сессии.", "Personal details, workspace role, and active sessions.")} action={<Link href="/app/settings" className="btn primary"><Settings/>{tr("Tahrirlash", "Изменить", "Edit")}</Link>}/>
    <section className="panel profile-panel">
      <div className="profile-hero"><span className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</span><div><h2>{user.name}</h2><p>{user.email}</p><StatusPill status={user.role}/></div></div>
      <div className="profile-details"><div><User/><span><small>{tr("To‘liq ism", "Полное имя", "Full name")}</small><strong>{user.name}</strong></span></div><div><Mail/><span><small>Email</small><strong>{user.email}</strong></span></div><div><ShieldCheck/><span><small>Workspace</small><strong>{user.workspace_name}</strong></span></div></div>
    </section>
    <section className="panel form-section">
      <div className="panel-header"><div><h2><KeyRound/> {tr("Faol sessiyalar", "Активные сессии", "Active sessions")}</h2><p>{tr("Keraksiz yoki noma’lum sessiyalarni bekor qiling.", "Завершите ненужные или неизвестные сессии.", "Revoke unnecessary or unfamiliar sessions.")}</p></div></div>
      {sessions.loading ? <LoadingState/> : sessions.error ? <ErrorState message={sessions.error} retry={sessions.reload}/> : !sessions.data?.items.length ? <EmptyState title={tr("Faol sessiya yo‘q", "Активных сессий нет", "No active sessions")} text={tr("Qayta kirganingizda yangi sessiya yaratiladi.", "Новая сессия появится после следующего входа.", "A new session is created when you sign in again.")}/> : <div className="simple-list">
        {sessions.data.items.map((item) => <div className="list-row" key={item.id}>
          <span className="row-icon"><KeyRound/></span>
          <div><strong>{item.workspace_name}{item.current ? tr(" · joriy", " · текущая", " · current") : ""}</strong><small>{tr("Oxirgi faollik", "Последняя активность", "Last active")} {timeAgo(item.last_seen_at)} · {tr(`${new Date(item.expires_at).toLocaleDateString("uz-UZ")} gacha`, `до ${new Date(item.expires_at).toLocaleDateString("ru-RU")}`, `until ${new Date(item.expires_at).toLocaleDateString("en-US")}`)}</small></div>
          <button className="btn danger" onClick={() => void revoke(item)}><Trash2/>{tr("Bekor qilish", "Завершить", "Revoke")}</button>
        </div>)}
      </div>}
    </section>
  </>;
}
