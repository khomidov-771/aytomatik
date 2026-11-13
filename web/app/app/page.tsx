"use client";

import Link from "next/link";
import {
  ArrowRight,
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
import { useSession } from "@/components/session-context";
import { useApi } from "@/hooks/use-api";
import { formatNumber, timeAgo } from "@/lib/format";
import type { Automation, InstagramAccount, Metrics } from "@/lib/types";

export default function DashboardPage() {
  const { tr } = usePreferences();
  const session = useSession();
  const analytics = useApi<{ summary: Metrics }>("/analytics/summary?days=7");
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
    { label: tr("Faol avtomatizatsiya", "Активные автоматизации", "Active automations"), value: activeAutomations.length, delta: tr("Faol qoidalar", "Активные правила", "Active rules"), icon: Bot, color: "blue" },
    { label: tr("Yuborilgan DM", "Отправлено DM", "DM sent"), value: metrics.replies_sent, delta: tr("Meta tasdiqlagan", "Подтверждено Meta", "Confirmed by Meta"), icon: Send, color: "cyan" },
    { label: tr("Mos izohlar", "Совпавшие комментарии", "Matched comments"), value: metrics.eligible_triggers, delta: tr("Faol qoidalarga mos", "Совпали с активными правилами", "Matched active rules"), icon: MessageCircle, color: "purple" },
    { label: tr("Konversiya", "Конверсия", "Conversion"), value: metrics.conversion, displayValue: `${metrics.conversion.toFixed(1)}%`, delta: tr("DM / mos izohlar", "DM / совпавшие комментарии", "DMs / matched comments"), icon: ArrowUpRight, color: "green" },
  ];
  const setupStep = connectedAccounts.length === 0 ? 1 : activeAutomations.length === 0 ? 2 : 3;
  const setupAction = setupStep === 1
    ? { href: "/app/accounts", label: tr("Instagram bilan kirish", "Войти через Instagram", "Connect Instagram") }
    : setupStep === 2
      ? { href: "/app/automations/new", label: tr("Birinchi avtomatlashtirishni yaratish", "Создать первую автоматизацию", "Create first automation") }
      : { href: "/app/automations", label: tr("Faol qoidalarni ko‘rish", "Посмотреть активные правила", "View active rules") };

  return <>
    <PageHeader
      eyebrow="REPLIO"
      title={tr("Boshqaruv paneli", "Панель управления", "Dashboard")}
      description={tr(`${session.user.name}, Comment-to-DM oqimingizning real holati.`, `${session.user.name}, реальное состояние вашего Comment-to-DM.`, `${session.user.name}, here's the real status of your Comment-to-DM workflow.`)}
      action={<Link href="/app/automations/new" className="btn primary"><Plus /> {tr("Yangi avtomatlashtirish", "Новая автоматизация", "New automation")}</Link>}
    />

    <section className={`setup-hero ${setupStep === 3 ? "ready" : ""}`}>
      <div className="setup-copy">
        <span className="setup-kicker"><ShieldCheck /> {tr("3 qadamda ishga tushiring", "Запуск за 3 шага", "Launch in 3 steps")}</span>
        <h2>{setupStep === 1 ? tr("Instagram akkauntingizni ulang", "Подключите Instagram аккаунт", "Connect your Instagram account") : setupStep === 2 ? tr("Birinchi Comment-to-DM oqimini yarating", "Создайте первый Comment-to-DM поток", "Create your first Comment-to-DM flow") : tr("Avtomatlashtirish qabul qilishga tayyor", "Автоматизация готова принимать события", "Automation is ready for events")}</h2>
        <p>{setupStep === 1 ? tr("Rasmiy Instagram/Meta oynasida Professional akkauntingiz bilan kiring. Parolingiz REPLIO’ga berilmaydi.", "Войдите в Professional аккаунт через официальное окно Instagram/Meta. REPLIO не получает ваш пароль.", "Sign in to your Professional account through the official Instagram/Meta window. REPLIO never receives your password.") : setupStep === 2 ? tr("Video yoki postni tanlang, kalit so‘z va yuboriladigan Direct xabarni yozing.", "Выберите видео или публикацию, ключевые слова и сообщение Direct.", "Choose a video or post, add keywords, and write the Direct message.") : tr("Yangi real commentlar webhook orqali kelganda natijalar shu dashboardda ko‘rinadi.", "Результаты новых реальных комментариев появятся здесь после webhook.", "Results from new real comments will appear here after the webhook arrives.")}</p>
        <div className="setup-actions"><Link href={setupAction.href} className="btn primary large">{setupAction.label}<ArrowRight /></Link><Link href="/app/automations" className="btn secondary large">{tr("Qoidalar", "Правила", "Rules")}</Link></div>
      </div>
      <div className="setup-steps" aria-label={tr("Sozlash bosqichlari", "Этапы настройки", "Setup steps")}>
        <div className={setupStep >= 1 ? "current" : ""}><span>{connectedAccounts.length ? <CircleCheckBig /> : "1"}</span><div><strong>{tr("Instagram’ni ulang", "Подключите Instagram", "Connect Instagram")}</strong><small>{connectedAccounts.length ? tr("Akkaunt ulangan", "Аккаунт подключён", "Account connected") : tr("Professional Business yoki Creator", "Professional Business или Creator", "Professional Business or Creator")}</small></div></div>
        <i />
        <div className={setupStep >= 2 ? "current" : ""}><span>{activeAutomations.length ? <CircleCheckBig /> : "2"}</span><div><strong>{tr("Post va keyword", "Публикация и keyword", "Post and keyword")}</strong><small>{activeAutomations.length ? tr("Faol qoida mavjud", "Есть активное правило", "Active rule exists") : tr("Barcha yoki aniq videolar", "Все или выбранные видео", "All or selected videos")}</small></div></div>
        <i />
        <div className={setupStep === 3 ? "current" : ""}><span>3</span><div><strong>{tr("Comment → DM", "Комментарий → DM", "Comment → DM")}</strong><small>{tr("Natijani kuzating", "Следите за результатом", "Track confirmed results")}</small></div></div>
      </div>
    </section>

    <div className="stat-grid">
      {stats.map((item) => {
        const Icon = item.icon;
        return <article className="stat-card" key={item.label}>
          <div className={`stat-icon ${item.color}`}><Icon /></div>
          <div className="stat-meta">
            <span>{item.label}</span>
          <strong>{item.displayValue ?? formatNumber(item.value)}</strong>
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
        {metrics.series.length ? <LineChart data={metrics.series} /> : <div className="chart-empty"><span><MessageCircle /></span><strong>{tr("Hali real comment kelmagan", "Реальных комментариев пока нет", "No real comments yet")}</strong><p>{tr("Instagram ulangan va qoida faol bo‘lgach, webhook eventlari shu yerda grafik bo‘lib ko‘rinadi.", "После подключения Instagram и активации правила webhook-события появятся на графике.", "After Instagram is connected and a rule is active, webhook events will appear in this chart.")}</p></div>}
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

