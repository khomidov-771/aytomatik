"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { api, ApiError, jsonBody } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const demo = useSearchParams().has("demo");
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState(demo ? "demo@ids.uz" : "");
  const [password, setPassword] = useState(demo ? "Demo1234!" : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNeedsVerification(false);
    try {
      await api("/auth/login", { method: "POST", ...jsonBody({ email, password, remember_me: rememberMe }) });
      router.push("/app");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Server bilan aloqa bo‘lmadi");
      setNeedsVerification(requestError instanceof ApiError && requestError.code === "email_unverified");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setLoading(true);
    try {
      const result = await api<{message: string; dev_verification_token?: string}>("/auth/resend-verification", { method: "POST", ...jsonBody({ email }) });
      setError(result.message);
      setVerificationToken(result.dev_verification_token ?? "");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Tasdiqlash xati tayyorlanmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Xush kelibsiz" subtitle="Hisobingizga xavfsiz kiring" footer={<>Hisobingiz yo‘qmi? <Link href="/register">Ro‘yxatdan o‘ting</Link></>}>
      <form className="auth-form" onSubmit={submit}>
        {error && <div className="form-alert error">{error}</div>}
        {needsVerification && <button className="btn secondary full" type="button" disabled={loading || !email} onClick={() => void resendVerification()}>Tasdiqlash xatini qayta yuborish</button>}
        {verificationToken && <Link className="btn secondary full" href={`/verify-email?token=${encodeURIComponent(verificationToken)}`}>Development tasdiqlash havolasi</Link>}
        <label><span>Email</span><div className="input-wrap"><Mail/><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="siz@kompaniya.uz" required/></div></label>
        <label><span>Parol</span><div className="input-wrap"><LockKeyhole/><input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required maxLength={72}/><button type="button" aria-label="Parolni ko‘rsatish" onClick={() => setShow(!show)}>{show ? <EyeOff/> : <Eye/>}</button></div></label>
        <div className="form-row"><label className="check"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)}/> <span>Eslab qolish</span></label><Link href="/forgot-password">Parolni unutdingizmi?</Link></div>
        <button className="btn primary full large" disabled={loading}>{loading ? "Kirilmoqda..." : "Kirish"}</button>
        <div className="auth-divider"><span>yoki</span></div>
        <button className="btn secondary full" type="button" disabled>Google bilan kirish · Tez orada</button>
        <p className="demo-hint">Demo: <button type="button" onClick={() => { setEmail("demo@ids.uz"); setPassword("Demo1234!"); }}>ma’lumotlarni to‘ldirish</button></p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm/></Suspense>;
}
