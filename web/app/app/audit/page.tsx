"use client";

import { useApi } from "@/hooks/use-api";
import { timeAgo } from "@/lib/format";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { usePreferences } from "@/components/preferences-provider";

type AuditEntry = {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default function AuditPage() {
  const { tr } = usePreferences();
  const audit = useApi<{items: AuditEntry[]}>("/audit-logs");
  if (audit.loading) return <LoadingState label={tr("Audit jurnali yuklanmoqda...", "Журнал аудита загружается...", "Loading audit log...")}/>;
  if (audit.error) return <ErrorState message={audit.error} retry={audit.reload}/>;
  const items = audit.data?.items ?? [];

  return <>
    <PageHeader eyebrow={tr("Xavfsizlik", "Безопасность", "Security")} title={tr("Audit jurnali", "Журнал аудита", "Audit log")} description={tr("Workspace doirasidagi muhim boshqaruv amallari.", "Важные действия управления в workspace.", "Important workspace administration actions.")}/>
    <section className="panel responsive-table">
      {items.length === 0 ? <EmptyState title={tr("Audit yozuvlari yo‘q", "Записей аудита нет", "No audit entries")} text={tr("Muhim o‘zgarishlar shu yerda vaqt va bajaruvchi bilan ko‘rinadi.", "Важные изменения появятся здесь с временем и автором.", "Important changes will appear here with time and actor.")}/> : <>
        <div className="table-head"><span>{tr("Amal", "Действие", "Action")}</span><span>{tr("Bajaruvchi", "Исполнитель", "Actor")}</span><span>{tr("Obyekt", "Объект", "Entity")}</span><span>{tr("Vaqt", "Время", "Time")}</span></div>
        {items.map((item) => <div className="table-row" key={item.id}>
          <span><strong>{item.action}</strong><small>{Object.keys(item.metadata ?? {}).length ? JSON.stringify(item.metadata) : tr("Metadata yo‘q", "Нет metadata", "No metadata")}</small></span>
          <span>{item.actor_name}</span>
          <span>{item.entity_type}{item.entity_id ? ` · ${item.entity_id}` : ""}</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>)}
      </>}
    </section>
  </>;
}
