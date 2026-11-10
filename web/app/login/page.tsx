"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { usePreferences } from "@/components/preferences-provider";
import { api, ApiError, jsonBody } from "@/lib/api";

function LoginForm() {
  const { tr } = usePreferences();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError(requestError instanceof ApiError ? requestError.message : tr("Server bilan aloqa bo‘lmadi", "Нет связи с сервером", "Could not reach the server"));
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
      setError(requestError instanceof ApiError ? requestError.message : tr("Tasdiqlash xati tayyorlanmadi", "Не удалось подготовить письмо подтверждения", "Could not prepare the verification email"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={tr("Xush kelibsiz", "Добро пожаловать", "Welcome back")} subtitle={tr("Hisobingizga xavfsiz kiring", "Безопасный вход в аккаунт", "Sign in securely to your account")} footer={<>{tr("Hisobingiz yo‘qmi?", "Нет аккаунта?", "No account?")} <Link href="/register">{tr("Ro‘yxatdan o‘ting", "Зарегистрироваться", "Create one")}</Link></>}>
      <form className="auth-form" onSubmit={submit}>
        {error && <div className="form-alert error">{error}</div>}
        {needsVerification && <button className="btn secondary full" type="button" disabled={loading || !email} onClick={() => void resendVerification()}>{tr("Tasdiqlash xatini qayta yuborish", "Отправить письмо повторно", "Resend verification email")}</button>}
        {verificationToken && <Link className="btn secondary full" href={`/verify-email?token=${encodeURIComponent(verificationToken)}`}>{tr("Development tasdiqlash havolasi", "Ссылка подтверждения для разработки", "Development verification link")}</Link>}
        <label><span>Email</span><div className="input-wrap"><Mail/><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="siz@kompaniya.uz" required/></div></label>
        <label><span>{tr("Parol", "Пароль", "Password")}</span><div className="input-wrap"><LockKeyhole/><input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required maxLength={72}/><button type="button" aria-label={tr("Parolni ko‘rsatish", "Показать пароль", "Show password")} onClick={() => setShow(!show)}>{show ? <EyeOff/> : <Eye/>}</button></div></label>
        <div className="form-row"><label className="check"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)}/> <span>{tr("Eslab qolish", "Запомнить меня", "Remember me")}</span></label><Link href="/forgot-password">{tr("Parolni unutdingizmi?", "Забыли пароль?", "Forgot password?")}</Link></div>
        <button className="btn primary full large" disabled={loading}>{loading ? tr("Kirilmoqda...", "Вход...", "Signing in...") : tr("Kirish", "Войти", "Sign in")}</button>
        <GoogleAuthButton intent="login" rememberMe={rememberMe} />
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return <LoginForm/>;
}
