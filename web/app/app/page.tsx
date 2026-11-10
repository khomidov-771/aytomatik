"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  CircleCheckBig,
  Instagram,
  MessageCircle,
  Plus,
  Send,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { LineChart } from "@/components/line-chart";
import { usePreferences } from "@/components/preferences-provider";
import { useApi } from "@/hooks/use-api";
import { formatNumber, timeAgo } from "@/lib/format";
import type { Automation, InstagramAccount, Metrics } from "@/lib/types";

export default function DashboardPage() {
  const { tr } = usePreferences();
  const analytics = useApi<{ summary: Metrics }>("/analytics/summary?days=7");
  const accounts = useApi<{ items: InstagramAccount[] }>("/instagram/accounts");
  const automations = useApi<{ items: Automation[] }>("/automations");

  if (analytics.loading || accounts.loading || automations.loading) {
    return <LoadingState label={tr("Dashboard tayyorlanmoqda...", "Панель загружается...", "Loading dashboard...")} />;
  }

  const error = analytics.error || accounts.error || automations.error;
  if (error) {
    return <ErrorState message={error} retry={() => {
      void analytics.reload();
      void accounts.reload();
      void automations.reload();
    }} />;
  }

  const metrics = analytics.data?.summary ?? {
    comments: 0,
    eligible_triggers: 0,
    replies_sent: 0,
    failures: 0,
    conversion: 0,
    series: [],
  };
  const accountItems = accounts.data?.items ?? [];
  const automationItems = automations.data?.items ?? [];
  const connectedAccounts = accountItems.filter((account) => account.status === "connected");
  const activeAutomations = automationItems.filter((rule) => rule.is_active);
  const stats = [
    { label: tr("Jami commentlar", "Всего комментариев", "Total comments"), value: metrics.comments, delta: tr("Webhook orqali", "Через webhook", "Via webhook"), icon: MessageCircle, color: "violet" },
    { label: tr("Tasdiqlangan DM", "Подтверждённые DM", "Confirmed DMs"), value: metrics.replies_sent, delta: metrics.failures ? tr(`${metrics.failures} xato`, `${metrics.failures} ошибок`, `${metrics.failures} failures`) : tr("Meta tasdiqlagan", "Подтверждено Meta", "Confirmed by Meta"), icon: Send, color: "cyan" },
    { label: tr("Faol avtomatlashtirish", "Активные автоматизации", "Active automations"), value: activeAutomations.length, delta: tr(`${automationItems.length} jami qoida`, `${automationItems.length} правил`, `${automationItems.length} total rules`), icon: Bot, color: "green" },
    { label: tr("Ulangan akkauntlar", "Подключённые аккаунты", "Connected accounts"), value: connectedAccounts.length, delta: tr(`${accountItems.length} jami akkaunt`, `${accountItems.length} аккаунтов`, `${accountItems.length} total accounts`), icon: Instagram, color: "pink" },
  ];

  return <>
    <PageHeader
      eyebrow="IDS Automate"
      title={tr("Boshqaruv paneli", "Панель управления", "Dashboard")}
      description={tr("Instagram Comment-to-DM oqimining real holati.", "Реальное состояние Instagram Comment-to-DM.", "Real status of your Instagram Comment-to-DM flow.")}
      action={<Link href="/app/automations/new" className="btn primary"><Plus /> {tr("Yangi avtomatlashtirish", "Новая автоматизация", "New automation")}</Link>}
    />

    <div className="stat-grid">
      {stats.map((item) => {
        const Icon = item.icon;
        return <article className="stat-card" key={item.label}>
          <div className={`stat-icon ${item.color}`}><Icon /></div>
          <div className="stat-meta">
            <span>{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
            <small><ArrowUpRight /> {item.delta}</small>
          </div>
        </article>;
      })}
    </div>

    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-header">
          <div><h2>{tr("Faollik dinamikasi", "Динамика активности", "Activity trend")}</h2><p>{tr("So‘nggi 7 kunlik real eventlar", "Реальные события за 7 дней", "Real events from the last 7 days")}</p></div>
          <div className="chart-legend"><span><i className="violet-dot" /> {tr("Comment", "Комментарии", "Comments")}</span><span><i className="cyan-dot" /> {tr("Tasdiqlangan DM", "Подтверждённые DM", "Confirmed DMs")}</span></div>
        </div>
        <LineChart data={metrics.series} />
      </section>

      <section className="panel connected-panel">
        <div className="panel-header"><div><h2>{tr("Instagram akkauntlar", "Аккаунты Instagram", "Instagram accounts")}</h2><p>{tr("Professional akkaunt ulanishlari", "Подключения Professional аккаунтов", "Professional account connections")}</p></div><Link href="/app/accounts">{tr("Barchasi", "Все", "View all")} <ChevronRight /></Link></div>
        {connectedAccounts.length ? <div className="simple-list">
          {connectedAccounts.slice(0, 4).map((account) => <div className="list-row" key={account.id}>
            <span className="account-avatar"><Instagram /></span>
            <div><strong>@{account.username}</strong><small>{account.account_type} · {account.last_sync_at ? timeAgo(account.last_sync_at) : tr("Sinxronlanmagan", "Не синхронизировано", "Not synced")}</small></div>
            <StatusPill status={account.status} />
          </div>)}
        </div> : <EmptyState title={tr("Akkaunt ulanmagan", "Аккаунт не подключён", "No account connected")} text={tr("Meta OAuth orqali Instagram Professional akkauntingizni ulang.", "Подключите Instagram Professional через Meta OAuth.", "Connect an Instagram Professional account through Meta OAuth.")} action={<Link href="/app/accounts" className="btn primary small">{tr("Akkaunt ulash", "Подключить аккаунт", "Connect account")}</Link>} />}
      </section>
    </div>

    <div className="dashboard-lower dashboard-lower-three">
      <section className="panel">
        <div className="panel-header"><div><h2>{tr("Oxirgi avtomatlashtirishlar", "Последние автоматизации", "Recent automations")}</h2><p>{tr("Ustuvor qoidalar", "Приоритетные правила", "Priority rules")}</p></div><Link href="/app/automations">{tr("Barchasi", "Все", "View all")} <ChevronRight /></Link></div>
        {automationItems.length ? <div className="simple-list">
          {automationItems.slice(0, 4).map((rule) => <Link href={`/app/automations/${rule.id}`} key={rule.id} className="list-row">
            <span className="row-icon"><Bot /></span>
            <div><strong>{rule.name}</strong><small>@{rule.account_username} · {rule.keywords.join(", ")}</small></div>
            <StatusPill status={rule.is_active ? "active" : "paused"} />
            <ChevronRight />
          </Link>)}
        </div> : <EmptyState title={tr("Qoidalar yo‘q", "Нет правил", "No rules yet")} text={tr("Birinchi comment-to-DM qoidasini yarating.", "Создайте первое Comment-to-DM правило.", "Create your first Comment-to-DM rule.")} action={<Link href="/app/automations/new" className="btn primary small">{tr("Qoida yaratish", "Создать правило", "Create rule")}</Link>} />}
      </section>

      <section className="panel flow-health">
        <div className="panel-header"><div><h2>{tr("Comment-to-DM holati", "Статус Comment-to-DM", "Comment-to-DM status")}</h2><p>{tr("Faqat tasdiqlangan natijalar", "Только подтверждённые результаты", "Confirmed outcomes only")}</p></div><ShieldCheck /></div>
        <div className="flow-score"><span><CircleCheckBig /></span><div><strong>{metrics.conversion.toFixed(1)}%</strong><small>{tr("DM yetkazish ulushi", "Доля доставки DM", "DM delivery rate")}</small></div></div>
        <div className="mini-row"><span>{tr("Mos triggerlar", "Совпавшие триггеры", "Eligible triggers")}</span><strong>{formatNumber(metrics.eligible_triggers)}</strong></div>
        <div className="mini-row"><span>{tr("Tasdiqlangan DM", "Подтверждённые DM", "Confirmed DMs")}</span><strong>{formatNumber(metrics.replies_sent)}</strong></div>
        <div className="mini-row"><span>{tr("Xatolar", "Ошибки", "Failures")}</span><strong>{formatNumber(metrics.failures)}</strong></div>
      </section>

      <section className="panel quick-actions">
        <div className="panel-header"><div><h2>{tr("Tezkor amallar", "Быстрые действия", "Quick actions")}</h2><p>{tr("Asosiy ishlar bir joyda", "Главные действия в одном месте", "Core actions in one place")}</p></div></div>
        <div className="quick-action-list">
          <Link href="/app/automations/new"><span><Plus /></span><div><strong>{tr("Yangi qoida yaratish", "Создать новое правило", "Create a new rule")}</strong><small>{tr("Comment → DM oqimini sozlash", "Настроить Comment → DM", "Configure Comment → DM")}</small></div><ChevronRight /></Link>
          <Link href="/app/accounts"><span><Instagram /></span><div><strong>{tr("Instagram ulash", "Подключить Instagram", "Connect Instagram")}</strong><small>{tr("Meta OAuth orqali", "Через Meta OAuth", "Through Meta OAuth")}</small></div><ChevronRight /></Link>
          <Link href="/app/settings"><span><Settings /></span><div><strong>{tr("Sozlamalarni ko‘rish", "Открыть настройки", "Open settings")}</strong><small>{tr("Integratsiya va xavfsizlik", "Интеграция и безопасность", "Integration and security")}</small></div><ChevronRight /></Link>
        </div>
      </section>
    </div>
  </>;
}
