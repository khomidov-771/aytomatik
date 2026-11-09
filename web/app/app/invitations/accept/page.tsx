"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Suspense, useState } from "react";
import { api, ApiError, jsonBody } from "@/lib/api";
import { PageHeader } from "@/components/ui";

function AcceptInvitation() {
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    setError("");
    try {
      const result = await api<{message: string}>("/team/invitations/accept", { method: "POST", ...jsonBody({ token }) });
      setMessage(result.message + ". Yuqoridagi tanlagich orqali yangi workspace’ga o‘ting.");
      setAccepted(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Taklif qabul qilinmadi");
    }
  }

  return <>
    <PageHeader eyebrow="Workspace" title="Taklifni qabul qilish" description="Taklif email manzilingiz va amal qilish muddati backend’da tekshiriladi."/>
    <section className="panel empty-state">
      <span className="empty-icon"><Mail/></span>
      {message ? <><h3>Workspace qo‘shildi</h3><p>{message}</p><Link className="btn primary" href="/app">Dashboardga o‘tish</Link></> : <><h3>Workspace taklifi</h3><p>{error || "Davom etish uchun taklifni tasdiqlang."}</p><button className="btn primary" disabled={!token || accepted} onClick={() => void accept()}>Taklifni qabul qilish</button></>}
    </section>
  </>;
}

export default function AcceptInvitationPage() {
  return <Suspense><AcceptInvitation/></Suspense>;
}
