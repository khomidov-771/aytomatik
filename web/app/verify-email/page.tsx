"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { api, ApiError, jsonBody } from "@/lib/api";

function VerifyEmailForm() {
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{message: string}>("/auth/verify-email", { method: "POST", ...jsonBody({ token }) });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Server bilan aloqa bo‘lmadi");
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell title="Email tasdiqlash" subtitle="Hisobni faollashtirish" footer={<Link href="/login">Kirish sahifasiga qaytish</Link>}>
    <form className="auth-form" onSubmit={verify}>
      {message && <div className="form-alert success">{message}. Endi hisobga kirishingiz mumkin.</div>}
      {error && <div className="form-alert error">{error}</div>}
      {!message && <button className="btn primary full large" disabled={!token || loading}>{loading ? "Tasdiqlanmoqda..." : "Emailni tasdiqlash"}</button>}
      {message && <Link className="btn primary full large" href="/login">Kirish</Link>}
    </form>
  </AuthShell>;
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailForm/></Suspense>;
}
