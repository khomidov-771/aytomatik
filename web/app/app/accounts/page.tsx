"use client";

import { AlertTriangle, Check, Instagram, Link2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { roleAtLeast, useSession } from "@/components/session-context";
import { DemoBadge, EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import type { InstagramAccount } from "@/lib/types";

const oauthErrors: Record<string, string> = {
  invalid_state: "OAuth state eskirgan yoki allaqachon ishlatilgan. Ulanishni qayta boshlang.",
  oauth_exchange_failed: "Meta avtorizatsiyasi yakunlanmadi. Unified Login konfiguratsiyasi, asset tanlovi va ruxsatlarni tekshiring.",
  token_storage_failed: "Access token xavfsiz saqlanmadi; akkaunt ulanmagan.",
  plan_limit: "Joriy tarifdagi Instagram akkaunt limiti tugagan.",
  account_already_connected: "Bu Instagram akkaunt boshqa workspace’ga ulangan.",
  account_save_failed: "Instagram akkauntini saqlashda xato yuz berdi.",
};

type AccountResponse = {
  items: InstagramAccount[];
  provider: string;
  login_mode: string;
  demo_mode: boolean;
};

function AccountsContent() {
  const session = useSession();
  const canManage = roleAtLeast(session.user.role, "manager");
  const searchParams = useSearchParams();
  const accounts = useApi<AccountResponse>("/instagram/accounts");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const callbackError = searchParams.get("error");
  const callbackNotice = callbackError
    ? (oauthErrors[callbackError] ?? "Meta OAuth ulanishi bekor qilindi.")
    : searchParams.has("connected") ? "Instagram akkaunti muvaffaqiyatli ulandi." : "";

  async function connect() {
    if (!canManage) return;
    setBusy("connect");
    setNotice("");
    try {
      const result = await api<{ authorization_url: string; demo_mode: boolean }>("/instagram/connect");
      window.location.assign(result.authorization_url);
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Ulash boshlanmadi");
      setBusy("");
    }
  }

  async function disconnect(account: InstagramAccount) {
    if (!canManage || !window.confirm(`@${account.username} akkauntini uzasizmi? Faol qoidalar ishlamay qoladi.`)) return;
    setBusy(account.id);
    setNotice("");
    try {
      await api(`/instagram/accounts/${account.id}`, { method: "DELETE" });
      await accounts.reload();
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Akkaunt uzilmadi");
    } finally {
      setBusy("");
    }
  }

  if (accounts.loading) return <LoadingState label="Akkauntlar yuklanmoqda..."/>;
  if (accounts.error) return <ErrorState message={accounts.error} retry={accounts.reload}/>;
  const data = accounts.data;
  const items = data?.items ?? [];
  const providerLabel = data?.provider === "meta" && data.login_mode === "unified" ? "Meta · Unified Login" : data?.provider;

  return <>
    <PageHeader
      eyebrow="Integratsiyalar"
      title="Instagram akkauntlar"
      description="Professional Business yoki Creator akkauntlarini rasmiy OAuth orqali ulang."
      action={canManage ? <button className="btn primary" onClick={() => void connect()} disabled={busy === "connect"}><Plus/>{busy === "connect" ? "Ulanmoqda..." : "Akkaunt ulash"}</button> : undefined}
    />
    {data?.demo_mode && <div className="notice-banner demo"><DemoBadge/><div><strong>Mock provider faol</strong><p>Bu akkaunt va yuborish natijalari demo. Haqiqiy Instagram’ga hech narsa yuborilmaydi.</p></div></div>}
    {!canManage && <div className="notice-banner warning"><ShieldCheck/><span>Akkaunt ulash, qayta ulash va uzish uchun Manager yoki Owner roli kerak.</span></div>}
    {(notice || callbackNotice) && <div className={`notice-banner ${callbackError || notice ? "warning" : "demo"}`}><AlertTriangle/><span>{notice || callbackNotice}</span></div>}
    <div className="integration-summary">
      <div><span className="summary-icon"><Link2/></span><div><strong>{items.filter((item) => item.status === "connected").length} ta ulangan</strong><p>Provider: {providerLabel}</p></div></div>
      <div className="security-note"><ShieldCheck/><span>Access tokenlar shifrlangan, UI’da ko‘rsatilmaydi</span></div>
    </div>
    {items.length === 0 ? <EmptyState
      title="Instagram akkaunt ulanmagan"
      text={!canManage ? "Manager yoki Owner akkaunt ulashi mumkin." : data?.login_mode === "unified" ? "Meta Unified Login orqali bitta Professional akkaunt assetini tanlang." : "Mock rejimda xavfsiz demo OAuth oqimini sinang yoki Meta credentials sozlang."}
      action={canManage ? <button className="btn primary" onClick={() => void connect()}><Instagram/>Akkaunt ulash</button> : undefined}
    /> : <div className="account-grid">{items.map((account) => <article className="account-card" key={account.id}>
      <div className="account-card-top"><span className="account-avatar large"><Instagram/></span><div><h3>@{account.username}</h3><p>{account.account_type}</p></div><StatusPill status={account.status}/></div>
      <div className="account-details"><div><span>Provider</span><strong>{account.provider}{account.provider === "mock" && " · Demo"}</strong></div><div><span>Oxirgi sync</span><strong>{account.last_sync_at ? timeAgo(account.last_sync_at) : "—"}</strong></div><div><span>Token muddati</span><strong>{formatDate(account.token_expires_at)}</strong></div></div>
      <div className="scope-list"><span>Ruxsatlar</span>{account.scopes.length ? account.scopes.map((scope) => <small key={scope}><Check/>{scope.replace("instagram_business_", "").replace("instagram_", "")}</small>) : <small>Meta grant ro‘yxati qaytmadi</small>}</div>
      {canManage && <div className="account-card-actions"><button className="btn secondary small" onClick={() => void connect()} disabled={Boolean(busy)}><RefreshCw/>Qayta ulash</button><button className="btn danger ghost small" onClick={() => void disconnect(account)} disabled={Boolean(busy)}><Trash2/>Uzish</button></div>}
    </article>)}</div>}
  </>;
}

export default function AccountsPage() {
  return <Suspense><AccountsContent/></Suspense>;
}
