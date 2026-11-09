"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { api, ApiError, jsonBody } from "@/lib/api";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Parollar bir xil emas");
      return;
    }
    try {
      const result = await api<{message: string}>("/auth/reset-password", { method: "POST", ...jsonBody({ token, password }) });
      setMessage(result.message);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Server bilan aloqa bo‘lmadi");
    }
  }

  return (
    <AuthShell title="Yangi parol" subtitle="Kuchli va noyob parol tanlang" footer={<Link href="/login">Kirish sahifasiga qaytish</Link>}>
      <form className="auth-form" onSubmit={submit}>
        {message && <div className="form-alert success">{message}. <Link href="/login">Kirish</Link></div>}
        {error && <div className="form-alert error">{error}</div>}
        <label><span>Yangi parol</span><div className="input-wrap"><LockKeyhole/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={72}/></div></label>
        <label><span>Parolni takrorlang</span><div className="input-wrap"><LockKeyhole/><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} maxLength={72}/></div></label>
        <button className="btn primary full large" disabled={!token}>Parolni yangilash</button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm/></Suspense>;
}
