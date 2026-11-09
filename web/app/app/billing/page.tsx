"use client";

import { Check, CreditCard, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Plan } from "@/lib/types";
import { useSession } from "@/components/session-context";

const plans = [{code: "free", name: "Free", price: 0, accounts: 1, rules: 3, events: 500}, {code: "starter", name: "Starter", price: 69000, accounts: 3, rules: 20, events: 10000}, {code: "pro", name: "Pro", price: 199000, accounts: 10, rules: 100, events: 100000}, {code: "agency", name: "Agency", price: 599000, accounts: 50, rules: 1000, events: 1000000}];

export default function BillingPage() {
  const session = useSession();
  const {data, loading, error, reload} = useApi<{plan: Plan; billing_mode: "manual_demo" | "disabled"; notice: string}>("/billing/plan");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  async function choose(code: string) { if (!data || data.billing_mode !== "manual_demo" || !confirm("Bu faqat development manual/demo holatini o‘zgartiradi. Davom etasizmi?")) return; setBusy(code); try { await api("/billing/plan", {method: "PATCH", ...jsonBody({code})}); setNotice("Tarif development demo holatida yangilandi"); await reload(); } catch (requestError) { setNotice(requestError instanceof ApiError ? requestError.message : "Tarif yangilanmadi"); } finally { setBusy(""); } }
  if (loading) return <LoadingState/>;
  if (error || !data) return <ErrorState message={error || "Tarif topilmadi"} retry={reload}/>;
  const current = data.plan;
  const demoMode = data.billing_mode === "manual_demo";
  const editable = demoMode && session.user.role === "owner";
  return <><PageHeader eyebrow={editable ? "Development billing" : demoMode ? "Faqat Owner" : "Billing o‘chirilgan"} title="Tarif va limitlar" description={data.notice}/>{notice && <div className="notice-banner warning"><CreditCard/><span>{notice}</span></div>}<section className="current-plan panel"><div><span className="section-label">Joriy tarif</span><h2>{current.name}</h2><p>Status: {current.status} · keyingi davr sanasi backend’dan keladi</p></div><div className="usage-meters"><div><span>Akkauntlar <b>{current.accounts_used}/{current.account_limit}</b></span><i><b style={{width: `${Math.min(current.accounts_used / current.account_limit * 100, 100)}%`}}/></i></div><div><span>Qoidalar <b>{current.rules_used}/{current.rule_limit}</b></span><i><b style={{width: `${Math.min(current.rules_used / current.rule_limit * 100, 100)}%`}}/></i></div></div></section><div className="pricing-grid in-app">{plans.map((plan) => <article className={`price-card ${plan.code === "pro" ? "featured" : ""} ${current.code === plan.code ? "current" : ""}`} key={plan.code}>{current.code === plan.code && <span className="popular">Joriy</span>}<h3>{plan.name}</h3><div className="price"><strong>{formatMoney(plan.price).replace(" so‘m", "")}</strong><span>so‘m / oy</span></div><ul><li><Check/>{plan.accounts} ta akkaunt</li><li><Check/>{plan.rules} ta qoida</li><li><Check/>{plan.events.toLocaleString()} event / oy</li></ul><button className={`btn ${current.code === plan.code ? "secondary" : "primary"}`} disabled={!editable || current.code === plan.code || Boolean(busy)} onClick={() => void choose(plan.code)}>{busy === plan.code ? "Yangilanmoqda..." : current.code === plan.code ? "Tanlangan" : editable ? "Demo tarifni tanlash" : demoMode ? "Faqat Owner o‘zgartiradi" : "To‘lov ulanmagan"}</button></article>)}</div><div className="notice-banner demo"><ShieldCheck/><div><strong>Billing cheklovi</strong><p>{editable ? "Bu development rejimi: karta to‘lovi amalga oshirilmaydi." : demoMode ? "Development demo tarifini faqat workspace Owner o‘zgartira oladi." : "Production’da payment provider mavjud emasligi sababli plan almashtirish yopiq."}</p></div></div></>;
}
