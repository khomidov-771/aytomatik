"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Settings, ShieldCheck, Trash2, User } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Session } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";

type SessionInfo = {
  id: string;
  workspace_name: string;
  current: boolean;
  last_seen_at: string;
  expires_at: string;
  created_at: string;
};

export default function ProfilePage() {
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
  if (profile.error || !profile.data) return <ErrorState message={profile.error || "Profil topilmadi"} retry={profile.reload}/>;
  const user = profile.data.user;

  return <>
    <PageHeader eyebrow="Hisob" title="Profil" description="Shaxsiy ma’lumot, workspace roli va faol sessiyalar." action={<Link href="/app/settings" className="btn primary"><Settings/>Tahrirlash</Link>}/>
    <section className="panel profile-panel">
      <div className="profile-hero"><span className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</span><div><h2>{user.name}</h2><p>{user.email}</p><StatusPill status={user.role}/></div></div>
      <div className="profile-details"><div><User/><span><small>To‘liq ism</small><strong>{user.name}</strong></span></div><div><Mail/><span><small>Email</small><strong>{user.email}</strong></span></div><div><ShieldCheck/><span><small>Workspace</small><strong>{user.workspace_name}</strong></span></div></div>
    </section>
    <section className="panel form-section">
      <div className="panel-header"><div><h2><KeyRound/> Faol sessiyalar</h2><p>Keraksiz yoki noma’lum sessiyalarni bekor qiling.</p></div></div>
      {sessions.loading ? <LoadingState/> : sessions.error ? <ErrorState message={sessions.error} retry={sessions.reload}/> : !sessions.data?.items.length ? <EmptyState title="Faol sessiya yo‘q" text="Qayta kirganingizda yangi sessiya yaratiladi."/> : <div className="simple-list">
        {sessions.data.items.map((item) => <div className="list-row" key={item.id}>
          <span className="row-icon"><KeyRound/></span>
          <div><strong>{item.workspace_name}{item.current ? " · joriy" : ""}</strong><small>Oxirgi faollik {timeAgo(item.last_seen_at)} · {new Date(item.expires_at).toLocaleDateString("uz-UZ")} gacha</small></div>
          <button className="btn danger" onClick={() => void revoke(item)}><Trash2/>Bekor qilish</button>
        </div>)}
      </div>}
    </section>
  </>;
}
