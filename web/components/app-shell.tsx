"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, Bot, ChevronDown, ClipboardList, Home, Instagram, LogOut, Menu, MessageSquareText, PanelLeftClose, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { ErrorState, LoadingState } from "./ui";
import { Logo } from "./logo";
import { PreferencesControls, usePreferences } from "./preferences-provider";
import { roleAtLeast, SessionProvider } from "./session-context";
import { SelectMenu } from "./select-menu";

const navigation = [
  { href: "/app", label: ["Bosh sahifa", "Главная", "Dashboard"], icon: Home, minimumRole: "customer" as const },
  { href: "/app/accounts", label: ["Instagram akkauntlar", "Аккаунты Instagram", "Instagram accounts"], icon: Instagram, minimumRole: "customer" as const },
  { href: "/app/automations", label: ["Avtomatlashtirish", "Автоматизации", "Automations"], icon: Bot, minimumRole: "customer" as const },
  { href: "/app/inbox", label: ["Inbox (Direct)", "Входящие (Direct)", "Inbox (Direct)"], icon: MessageSquareText, minimumRole: "operator" as const },
  { href: "/app/analytics", label: ["Analitika", "Аналитика", "Analytics"], icon: BarChart3, minimumRole: "manager" as const },
  { href: "/app/team", label: ["Jamoa", "Команда", "Team"], icon: Users, minimumRole: "manager" as const },
  { href: "/app/audit", label: ["Audit jurnali", "Журнал аудита", "Audit log"], icon: ClipboardList, minimumRole: "manager" as const },
  { href: "/app/settings", label: ["Sozlamalar", "Настройки", "Settings"], icon: Settings, minimumRole: "customer" as const },
];

type WorkspaceList = {
  items: {id: string; name: string; role: string}[];
  active_workspace_id: string;
};

function WorkspaceSwitcher({ session }: { session: Session }) {
  const { tr } = usePreferences();
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

  const workspaceOptions = (workspaces.data?.items ?? [{ id: session.user.workspace_id, name: session.user.workspace_name, role: session.user.role }]).map((workspace) => ({ value: workspace.id, label: workspace.name, description: workspace.role }));

  return <div className="workspace-switch">
    <span className="workspace-icon">I</span>
    <SelectMenu value={workspaces.data?.active_workspace_id ?? session.user.workspace_id} options={workspaceOptions} onChange={(workspaceID) => void switchWorkspace(workspaceID)} ariaLabel={tr("Workspace almashtirish", "Сменить рабочую область", "Switch workspace")} disabled={switching || workspaces.loading || !workspaces.data || workspaces.data.items.length < 2} className="workspace-select" />
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { tr } = usePreferences();
  const router = useRouter();
  const path = usePathname();
  const { data: session, loading, error, reload } = useApi<Session>("/me");
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) return <div className="center-screen"><LoadingState label={tr("Workspace yuklanmoqda...", "Workspace загружается...", "Loading workspace...")}/></div>;
  if (error || !session) return <div className="center-screen"><ErrorState message={error || tr("Sessiya topilmadi", "Сессия не найдена", "Session not found")} retry={() => { if (error.includes("Kirish") || error.includes("Sessiya")) router.push("/login"); else void reload(); }}/></div>;
  const initials = session.user.name.split(" ").map((value) => value[0]).join("").slice(0, 2).toUpperCase();
  const visibleNavigation = navigation.filter((item) => roleAtLeast(session.user.role, item.minimumRole)).map((item) => ({ ...item, translatedLabel: tr(item.label[0], item.label[1], item.label[2]) }));

  return <SessionProvider session={session}><div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand"><Logo compact={collapsed}/><button className="icon-btn sidebar-close" aria-label={tr("Menyuni yopish", "Закрыть меню", "Close menu")} onClick={() => setOpen(false)}><X/></button></div>
      <nav aria-label={tr("Dashboard navigatsiyasi", "Навигация панели", "Dashboard navigation")}>{visibleNavigation.map((item) => { const Icon = item.icon; const active = item.href === "/app" ? path === item.href : path.startsWith(item.href); return <Link href={item.href} key={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)} title={collapsed ? item.translatedLabel : undefined}><Icon/><span>{item.translatedLabel}</span></Link>; })}</nav>
      <div className="sidebar-bottom">
        <div className="usage-card"><div><span>{tr("Asosiy oqim", "Основной поток", "Core flow")}</span><strong>Comment → DM</strong></div><Link href="/app/automations">{tr("Qoidalarni ko‘rish", "Посмотреть правила", "View rules")}</Link></div>
        <button className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)}><PanelLeftClose/><span>{tr("Yon panelni yig‘ish", "Свернуть панель", "Collapse sidebar")}</span></button>
      </div>
    </aside>
    {open && <button className="sidebar-overlay" aria-label={tr("Menyuni yopish", "Закрыть меню", "Close menu")} onClick={() => setOpen(false)}/>}
    <div className="app-main">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn mobile-menu" aria-label={tr("Menyuni ochish", "Открыть меню", "Open menu")} onClick={() => setOpen(true)}><Menu/></button><WorkspaceSwitcher session={session}/></div>
        <div className="topbar-actions"><PreferencesControls compact/><Link href="/app/settings#notifications" className="icon-btn" aria-label={tr("Bildirishnoma sozlamalari", "Настройки уведомлений", "Notification settings")} title={tr("Bildirishnoma sozlamalari", "Настройки уведомлений", "Notification settings")}><Bell/></Link><Link href="/app/profile" className="profile-chip"><span className="avatar">{initials}</span><span><strong>{session.user.name}</strong><small>{session.user.role}</small></span><ChevronDown/></Link><button className="icon-btn logout" aria-label={tr("Chiqish", "Выйти", "Sign out")} onClick={() => void logout()}><LogOut/></button></div>
      </header>
      <main className="app-content">{children}</main>
    </div>
    <nav className="mobile-bottom" aria-label={tr("Mobil navigatsiya", "Мобильная навигация", "Mobile navigation")}>{visibleNavigation.slice(0, 5).map((item) => { const Icon = item.icon; const active = item.href === "/app" ? path === item.href : path.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon/><span>{item.translatedLabel.split(" ")[0]}</span></Link>; })}</nav>
  </div></SessionProvider>;
}
