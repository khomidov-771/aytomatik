"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, Bot, ChevronDown, CircleDollarSign, ClipboardList, CreditCard, Home, Instagram, LogOut, Menu, MessageSquareText, PanelLeftClose, Settings, TestTube2, Users, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { DemoBadge, ErrorState, LoadingState } from "./ui";
import { Logo } from "./logo";
import { roleAtLeast, SessionProvider } from "./session-context";

const navigation = [
  { href: "/app", label: "Bosh sahifa", icon: Home, minimumRole: "customer" as const },
  { href: "/app/accounts", label: "Instagram akkauntlar", icon: Instagram, minimumRole: "customer" as const },
  { href: "/app/automations", label: "Avtomatlashtirish", icon: Bot, minimumRole: "customer" as const },
  { href: "/app/inbox", label: "Inbox (Direct)", icon: MessageSquareText, minimumRole: "operator" as const },
  { href: "/app/campaigns", label: "Kampaniyalar", icon: CircleDollarSign, minimumRole: "customer" as const },
  { href: "/app/analytics", label: "Analitika", icon: BarChart3, minimumRole: "manager" as const },
  { href: "/app/team", label: "Jamoa", icon: Users, minimumRole: "manager" as const },
  { href: "/app/audit", label: "Audit jurnali", icon: ClipboardList, minimumRole: "manager" as const },
  { href: "/app/billing", label: "Tarif", icon: CreditCard, minimumRole: "customer" as const },
  { href: "/app/settings", label: "Sozlamalar", icon: Settings, minimumRole: "customer" as const },
  { href: "/app/mock-lab", label: "Mock laboratoriya", icon: TestTube2, minimumRole: "manager" as const },
];

type WorkspaceList = {
  items: {id: string; name: string; role: string}[];
  active_workspace_id: string;
};

function WorkspaceSwitcher({ session }: { session: Session }) {
  const workspaces = useApi<WorkspaceList>("/workspaces");
  const [switching, setSwitching] = useState(false);

  async function switchWorkspace(workspaceID: string) {
    if (!workspaceID || workspaceID === session.user.workspace_id) return;
    setSwitching(true);
    try {
      await api(`/workspaces/${workspaceID}/switch`, { method: "POST" });
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  return <label className="workspace-switch" style={{ position: "relative" }}>
    <span className="workspace-icon">I</span>
    <span><small>Workspace</small><strong>{session.user.workspace_name}</strong></span>
    <select style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} aria-label="Workspace almashtirish" value={workspaces.data?.active_workspace_id ?? session.user.workspace_id} disabled={switching || workspaces.loading || !workspaces.data || workspaces.data.items.length < 2} onChange={(event) => void switchWorkspace(event.target.value)}>
      {(workspaces.data?.items ?? [{ id: session.user.workspace_id, name: session.user.workspace_name, role: session.user.role }]).map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name} · {workspace.role}</option>)}
    </select>
    <ChevronDown/>
  </label>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { data: session, loading, error, reload } = useApi<Session>("/me");
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) return <div className="center-screen"><LoadingState label="Workspace yuklanmoqda..."/></div>;
  if (error || !session) return <div className="center-screen"><ErrorState message={error || "Sessiya topilmadi"} retry={() => { if (error.includes("Kirish") || error.includes("Sessiya")) router.push("/login"); else void reload(); }}/></div>;
  const initials = session.user.name.split(" ").map((value) => value[0]).join("").slice(0, 2).toUpperCase();
  const visibleNavigation = navigation.filter((item) => roleAtLeast(session.user.role, item.minimumRole) && (item.href !== "/app/mock-lab" || session.demo_mode));

  return <SessionProvider session={session}><div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand"><Logo compact={collapsed}/><button className="icon-btn sidebar-close" aria-label="Menyuni yopish" onClick={() => setOpen(false)}><X/></button></div>
      <nav aria-label="Dashboard navigatsiyasi">{visibleNavigation.map((item) => { const Icon = item.icon; const active = item.href === "/app" ? path === item.href : path.startsWith(item.href); return <Link href={item.href} key={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)} title={collapsed ? item.label : undefined}><Icon/><span>{item.label}</span></Link>; })}</nav>
      <div className="sidebar-bottom">
        <div className="usage-card"><div><span>Tarif va limitlar</span><strong>Backend holati</strong></div><Link href="/app/billing">Tarifni ko‘rish</Link></div>
        <button className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)}><PanelLeftClose/><span>Yon panelni yig‘ish</span></button>
      </div>
    </aside>
    {open && <button className="sidebar-overlay" aria-label="Menyuni yopish" onClick={() => setOpen(false)}/>}
    <div className="app-main">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn mobile-menu" aria-label="Menyuni ochish" onClick={() => setOpen(true)}><Menu/></button><WorkspaceSwitcher session={session}/><DemoBadge show={session.demo_mode}/></div>
        <div className="topbar-actions"><Link href="/app/settings#notifications" className="icon-btn" aria-label="Bildirishnoma sozlamalari" title="Bildirishnoma sozlamalari"><Bell/></Link><Link href="/app/profile" className="profile-chip"><span className="avatar">{initials}</span><span><strong>{session.user.name}</strong><small>{session.user.role}</small></span><ChevronDown/></Link><button className="icon-btn logout" aria-label="Chiqish" onClick={() => void logout()}><LogOut/></button></div>
      </header>
      <main className="app-content">{children}</main>
    </div>
    <nav className="mobile-bottom" aria-label="Mobil navigatsiya">{visibleNavigation.slice(0, 5).map((item) => { const Icon = item.icon; const active = item.href === "/app" ? path === item.href : path.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon/><span>{item.label.split(" ")[0]}</span></Link>; })}</nav>
  </div></SessionProvider>;
}
