"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { usePreferences } from "@/components/preferences-provider";
import { api, ApiError, jsonBody } from "@/lib/api";

function VerifyEmailForm() {
  const { tr } = usePreferences();
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
      setError(requestError instanceof ApiError ? requestError.message : tr("Server bilan aloqa bo‘lmadi", "Нет связи с сервером", "Could not reach the server"));
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell title={tr("Email tasdiqlash", "Подтверждение email", "Verify email")} subtitle={tr("Hisobni faollashtirish", "Активация аккаунта", "Activate your account")} footer={<Link href="/login">{tr("Kirish sahifasiga qaytish", "Вернуться ко входу", "Back to sign in")}</Link>}>
    <form className="auth-form" onSubmit={verify}>
      {message && <div className="form-alert success">{message}. {tr("Endi hisobga kirishingiz mumkin.", "Теперь можно войти в аккаунт.", "You can now sign in.")}</div>}
      {error && <div className="form-alert error">{error}</div>}
      {!message && <button className="btn primary full large" disabled={!token || loading}>{loading ? tr("Tasdiqlanmoqda...", "Подтверждение...", "Verifying...") : tr("Emailni tasdiqlash", "Подтвердить email", "Verify email")}</button>}
      {message && <Link className="btn primary full large" href="/login">{tr("Kirish", "Войти", "Sign in")}</Link>}
    </form>
  </AuthShell>;
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailForm/></Suspense>;
}
