"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronRight,
  Instagram,
  MessageCircle,
  Plus,
  Send,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { LineChart } from "@/components/line-chart";
import { usePreferences } from "@/components/preferences-provider";
import { groupSummary } from "@/lib/keyword-groups";
import { roleAtLeast,useSession } from "@/components/session-context";
import { useApi } from "@/hooks/use-api";
import { formatNumber, timeAgo } from "@/lib/format";
import type { Automation, InstagramAccount, Metrics } from "@/lib/types";

export default function DashboardPage() {
  const { tr } = usePreferences();
  const session = useSession();
  const canManage=roleAtLeast(session.user.role,"manager");
  const analytics = useApi<{ summary: Metrics }>(canManage ? "/analytics/summary?days=7" : null);
  const accounts = useApi<{ items: InstagramAccount[]; meta_configured?: boolean }>("/instagram/accounts");
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
    { label: tr("Jami izohlar", "Все комментарии", "Total comments"), value: metrics.comments, icon: MessageCircle },
    { label: tr("Mos izohlar", "Совпавшие комментарии", "Matched comments"), value: metrics.eligible_triggers, icon: Bot },
    { label: tr("Yuborilgan Direct", "Отправлено в Direct", "DMs sent"), value: metrics.replies_sent, icon: Send },
    { label: tr("Direct olgan izohlar", "Комментарии с ответом в Direct", "Comments answered by DM"), value: metrics.comments ? metrics.conversion.toLocaleString(undefined,{maximumFractionDigits:1})+"%" : "—", icon: ArrowUpRight },
  ];
  const needsAccount=connectedAccounts.length===0;
  const needsSetup=needsAccount || activeAutomations.length===0;
  return <div className="workspace-overview">
    <PageHeader title={tr("Boshqaruv paneli", "Панель управления", "Dashboard")}
      description={tr("So‘nggi 7 kun", "Последние 7 дней", "Last 7 days")}
      action={canManage && !needsSetup ? <Link href="/app/automations/new" className="btn primary"><Plus/>{tr("Yangi qoida","Новое правило","New rule")}</Link> : undefined}/>
    {canManage && needsSetup && <div className="overview-next"><span className="overview-next-icon">{needsAccount?<Instagram/>:<Bot/>}</span>
      <div><strong>{needsAccount ? tr("Instagram akkauntingizni ulang","Подключите Instagram","Connect Instagram") : tr("Birinchi faol qoidani sozlang","Настройте активное правило","Set up an active rule")}</strong>
        <p>{needsAccount ? tr("Postlaringizni tanlash uchun Professional akkauntingiz bilan kiring.","Войдите в профессиональный аккаунт, чтобы выбрать публикации.","Sign in with your professional account to choose posts.") : tr("Postni tanlang va javob matnini kiriting.","Выберите публикацию и напишите ответ.","Choose a post and write a reply.")}</p></div>
      <Link className="btn secondary" href={needsAccount?"/app/accounts":"/app/automations/new"}>{tr("Davom etish","Продолжить","Continue")}<ArrowRight/></Link></div>}
    {canManage && <div className="stat-grid">
      {stats.map((item) => {
        const Icon = item.icon;
        return <article className="stat-card" key={item.label}>
          <div className="stat-icon"><Icon /></div>
          <div className="stat-meta">
            <span>{item.label}</span>
          <strong>{typeof item.value === "number" ? formatNumber(item.value) : item.value}</strong>
          </div>
        </article>;
      })}
    </div>}

    <div className="dashboard-grid">
      {canManage && <section className="panel chart-panel">
        <div className="panel-header">
          <div><h2>{tr("Faollik dinamikasi", "Динамика активности", "Activity trend")}</h2></div>
          <div className="chart-legend"><span><i className="violet-dot" /> {tr("Comment", "Комментарии", "Comments")}</span><span><i className="cyan-dot" /> {tr("Tasdiqlangan DM", "Подтверждённые DM", "Confirmed DMs")}</span></div>
        </div>
        {metrics.series?.some(point => point.comments || point.replies) ? <LineChart data={metrics.series} /> : <div className="chart-empty"><span><MessageCircle /></span><strong>{tr("Hali real comment kelmagan", "Реальных комментариев пока нет", "No real comments yet")}</strong><p>{tr("Instagram ulangan va qoida faol bo‘lgach, webhook eventlari shu yerda grafik bo‘lib ko‘rinadi.", "После подключения Instagram и активации правила webhook-события появятся на графике.", "After Instagram is connected and a rule is active, webhook events will appear in this chart.")}</p></div>}
      </section>}

      <section className="panel connected-panel">
        <div className="panel-header"><div><h2>{tr("Instagram akkauntlar", "Аккаунты Instagram", "Instagram accounts")}</h2><p>{tr("Professional akkaunt ulanishlari", "Подключения Professional аккаунтов", "Professional account connections")}</p></div><Link href="/app/accounts">{tr("Barchasi", "Все", "View all")} <ChevronRight /></Link></div>
        {connectedAccounts.length ? <div className="simple-list">
          {connectedAccounts.slice(0, 4).map((account) => <div className="list-row" key={account.id}>
            <span className="account-avatar"><Instagram /></span>
            <div><strong>@{account.username}</strong><small>{account.account_type} · {account.last_sync_at ? timeAgo(account.last_sync_at) : tr("Sinxronlanmagan", "Не синхронизировано", "Not synced")}</small></div>
            <StatusPill status={account.status} />
          </div>)}
        </div> : <EmptyState title={tr("Akkaunt ulanmagan", "Аккаунт не подключён", "No account connected")} text={tr("Meta OAuth orqali Instagram Professional akkauntingizni ulang.", "Подключите Instagram Professional через Meta OAuth.", "Connect an Instagram Professional account through Meta OAuth.")} action={canManage && <Link href="/app/accounts" className="btn primary small">{tr("Akkaunt ulash", "Подключить аккаунт", "Connect account")}</Link>} />}
      </section>
    </div>

    <div className="overview-rules">
      <section className="panel">
        <div className="panel-header"><div><h2>{tr("Oxirgi avtomatlashtirishlar", "Последние автоматизации", "Recent automations")}</h2><p>{tr("Ustuvor qoidalar", "Приоритетные правила", "Priority rules")}</p></div><Link href="/app/automations">{tr("Barchasi", "Все", "View all")} <ChevronRight /></Link></div>
        {automationItems.length ? <div className="simple-list">
          {automationItems.slice(0, 4).map((rule) => <Link href={`/app/automations/${rule.id}`} key={rule.id} className="list-row">
            <span className="row-icon"><Bot /></span>
            <div><strong>{rule.name}</strong><small>@{rule.account_username} · {groupSummary(rule)}</small></div>
            <StatusPill status={rule.is_active ? "active" : "paused"} />
            <ChevronRight />
          </Link>)}
        </div> : <EmptyState title={tr("Qoidalar yo‘q", "Нет правил", "No rules yet")} text={tr("Birinchi comment-to-DM qoidasini yarating.", "Создайте первое Comment-to-DM правило.", "Create your first Comment-to-DM rule.")} action={canManage && <Link href="/app/automations/new" className="btn primary small">{tr("Qoida yaratish", "Создать правило", "Create rule")}</Link>} />}
      </section>

    </div>
  </div>;
}
