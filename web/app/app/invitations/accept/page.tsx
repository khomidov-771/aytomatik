"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Suspense, useState } from "react";
import { api, ApiError, jsonBody } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { usePreferences } from "@/components/preferences-provider";

function AcceptInvitation() {
  const { tr } = usePreferences();
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    setError("");
    try {
      const result = await api<{message: string}>("/team/invitations/accept", { method: "POST", ...jsonBody({ token }) });
      setMessage(result.message + tr(". Yuqoridagi tanlagich orqali yangi workspace’ga o‘ting.", ". Перейдите в новый workspace через переключатель выше.", ". Switch to the new workspace using the selector above."));
      setAccepted(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : tr("Taklif qabul qilinmadi", "Приглашение не принято", "Invitation was not accepted"));
    }
  }

  return <>
    <PageHeader eyebrow="Workspace" title={tr("Taklifni qabul qilish", "Принять приглашение", "Accept invitation")} description={tr("Taklif email manzilingiz va amal qilish muddati backend’da tekshiriladi.", "Email и срок приглашения проверяются на backend.", "The invitation email and expiry are verified by the backend.")}/>
    <section className="panel empty-state">
      <span className="empty-icon"><Mail/></span>
      {message ? <><h3>{tr("Workspace qo‘shildi", "Workspace добавлен", "Workspace added")}</h3><p>{message}</p><Link className="btn primary" href="/app">{tr("Dashboardga o‘tish", "Перейти в Dashboard", "Go to dashboard")}</Link></> : <><h3>{tr("Workspace taklifi", "Приглашение в workspace", "Workspace invitation")}</h3><p>{error || tr("Davom etish uchun taklifni tasdiqlang.", "Подтвердите приглашение, чтобы продолжить.", "Confirm the invitation to continue.")}</p><button className="btn primary" disabled={!token || accepted} onClick={() => void accept()}>{tr("Taklifni qabul qilish", "Принять приглашение", "Accept invitation")}</button></>}
    </section>
  </>;
}

export default function AcceptInvitationPage() {
  return <Suspense><AcceptInvitation/></Suspense>;
}
