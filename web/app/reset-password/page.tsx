"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { usePreferences } from "@/components/preferences-provider";
import { api, ApiError, jsonBody } from "@/lib/api";

function ResetPasswordForm() {
  const { tr } = usePreferences();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(tr("Parollar bir xil emas", "Пароли не совпадают", "Passwords do not match"));
      return;
    }
    try {
      const result = await api<{message: string}>("/auth/reset-password", { method: "POST", ...jsonBody({ token, password }) });
      setMessage(result.message);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : tr("Server bilan aloqa bo‘lmadi", "Нет связи с сервером", "Could not reach the server"));
    }
  }

  return (
    <AuthShell title={tr("Yangi parol", "Новый пароль", "New password")} subtitle={tr("Kuchli va noyob parol tanlang", "Выберите надёжный уникальный пароль", "Choose a strong, unique password")} footer={<Link href="/login">{tr("Kirish sahifasiga qaytish", "Вернуться ко входу", "Back to sign in")}</Link>}>
      <form className="auth-form" onSubmit={submit}>
        {message && <div className="form-alert success">{message}. <Link href="/login">{tr("Kirish", "Войти", "Sign in")}</Link></div>}
        {error && <div className="form-alert error">{error}</div>}
        <label><span>{tr("Yangi parol", "Новый пароль", "New password")}</span><div className="input-wrap"><LockKeyhole/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={72}/></div></label>
        <label><span>{tr("Parolni takrorlang", "Повторите пароль", "Confirm password")}</span><div className="input-wrap"><LockKeyhole/><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} maxLength={72}/></div></label>
        <button className="btn primary full large" disabled={!token}>{tr("Parolni yangilash", "Обновить пароль", "Update password")}</button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm/></Suspense>;
}
