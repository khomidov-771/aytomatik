"use client";

import { useApi } from "@/hooks/use-api";
import { timeAgo } from "@/lib/format";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";

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
  const audit = useApi<{items: AuditEntry[]}>("/audit-logs");
  if (audit.loading) return <LoadingState label="Audit jurnali yuklanmoqda..."/>;
  if (audit.error) return <ErrorState message={audit.error} retry={audit.reload}/>;
  const items = audit.data?.items ?? [];

  return <>
    <PageHeader eyebrow="Xavfsizlik" title="Audit jurnali" description="Workspace doirasidagi muhim boshqaruv amallari."/>
    <section className="panel responsive-table">
      {items.length === 0 ? <EmptyState title="Audit yozuvlari yo‘q" text="Muhim o‘zgarishlar shu yerda vaqt va bajaruvchi bilan ko‘rinadi."/> : <>
        <div className="table-head"><span>Amal</span><span>Bajaruvchi</span><span>Obyekt</span><span>Vaqt</span></div>
        {items.map((item) => <div className="table-row" key={item.id}>
          <span><strong>{item.action}</strong><small>{Object.keys(item.metadata ?? {}).length ? JSON.stringify(item.metadata) : "Metadata yo‘q"}</small></span>
          <span>{item.actor_name}</span>
          <span>{item.entity_type}{item.entity_id ? ` · ${item.entity_id}` : ""}</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>)}
      </>}
    </section>
  </>;
}
