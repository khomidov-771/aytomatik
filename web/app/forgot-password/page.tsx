"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { usePreferences } from "@/components/preferences-provider";
import { api, ApiError, jsonBody } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { tr } = usePreferences();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devToken, setDevToken] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ message: string; dev_reset_token?: string }>("/auth/forgot-password", { method: "POST", ...jsonBody({ email }) });
      setMessage(result.message);
      setDevToken(result.dev_reset_token ?? "");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : tr("Server bilan aloqa bo‘lmadi", "Нет связи с сервером", "Could not reach the server"));
    }
  }

  return <AuthShell title={tr("Parolni tiklash", "Восстановление пароля", "Reset your password")} subtitle={tr("Email manzilingizni kiriting", "Введите ваш email", "Enter your email address")} footer={<Link href="/login">{tr("Kirish sahifasiga qaytish", "Вернуться ко входу", "Back to sign in")}</Link>}>
    <form className="auth-form" onSubmit={submit}>
      {message && <div className="form-alert success">{message}{devToken && <><br /><Link href={`/reset-password?token=${devToken}`}>{tr("Development tiklash havolasi", "Ссылка сброса для разработки", "Development reset link")}</Link></>}</div>}
      {error && <div className="form-alert error">{error}</div>}
      <label><span>Email</span><div className="input-wrap"><Mail /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@company.com" /></div></label>
      <button className="btn primary full large">{tr("Yo‘riqnoma yuborish", "Отправить инструкцию", "Send instructions")}</button>
    </form>
  </AuthShell>;
}
