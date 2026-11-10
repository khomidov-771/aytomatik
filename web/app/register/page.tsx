"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail, User } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { usePreferences } from "@/components/preferences-provider";
import { api, ApiError, jsonBody } from "@/lib/api";

type RegisterResult = {
  email_verification_required: boolean;
  dev_verification_token?: string;
  notice?: string;
};

export default function RegisterPage() {
  const { tr } = usePreferences();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", accept_terms: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [registered, setRegistered] = useState(false);

  function field(name: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError(tr("Parollar bir xil emas", "Пароли не совпадают", "Passwords do not match"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<RegisterResult>("/auth/register", {
        method: "POST",
        ...jsonBody({ name: form.name, email: form.email, password: form.password, accept_terms: form.accept_terms }),
      });
      setVerificationToken(result.dev_verification_token ?? "");
      setRegistered(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : tr("Server bilan aloqa bo‘lmadi", "Нет связи с сервером", "Could not reach the server"));
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return <AuthShell title={tr("Emailni tasdiqlang", "Подтвердите email", "Verify your email")} subtitle={tr(`Tasdiqlash yo‘riqnomasi ${form.email} manziliga tayyorlandi`, `Инструкция отправлена на ${form.email}`, `Verification instructions were prepared for ${form.email}`)} footer={<Link href="/login">{tr("Kirish sahifasiga qaytish", "Вернуться ко входу", "Back to sign in")}</Link>}>
      <div className="auth-form">
        <div className="form-alert success">{tr("Hisob yaratildi. Email tasdiqlanmaguncha kirish yopiq.", "Аккаунт создан. Вход доступен после подтверждения email.", "Account created. Sign-in stays locked until the email is verified.")}</div>
        {verificationToken && <Link className="btn primary full large" href={`/verify-email?token=${encodeURIComponent(verificationToken)}`}>{tr("Development tasdiqlash havolasi", "Ссылка подтверждения для разработки", "Development verification link")}</Link>}
        {!verificationToken && <p>{tr("Email xatidagi havolani oching. Havola 24 soat amal qiladi.", "Откройте ссылку в письме. Она действует 24 часа.", "Open the link in the email. It is valid for 24 hours.")}</p>}
      </div>
    </AuthShell>;
  }

  return <AuthShell title={tr("Ro‘yxatdan o‘tish", "Регистрация", "Create an account")} subtitle={tr("Birinchi workspace’ingizni yarating", "Создайте первый workspace", "Create your first workspace")} footer={<>{tr("Hisobingiz bormi?", "Уже есть аккаунт?", "Already have an account?")} <Link href="/login">{tr("Kirish", "Войти", "Sign in")}</Link></>}>
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="form-alert error">{error}</div>}
      <label><span>{tr("Ism", "Имя", "Name")}</span><div className="input-wrap"><User/><input value={form.name} onChange={(event) => field("name", event.target.value)} autoComplete="name" placeholder={tr("Ismingiz", "Ваше имя", "Your name")} required minLength={2}/></div></label>
      <label><span>Email</span><div className="input-wrap"><Mail/><input type="email" value={form.email} onChange={(event) => field("email", event.target.value)} autoComplete="email" placeholder="siz@kompaniya.uz" required/></div></label>
      <label><span>{tr("Parol", "Пароль", "Password")}</span><div className="input-wrap"><LockKeyhole/><input type={show ? "text" : "password"} value={form.password} onChange={(event) => field("password", event.target.value)} autoComplete="new-password" placeholder={tr("Kamida 8 belgi", "Минимум 8 символов", "At least 8 characters")} required minLength={8} maxLength={72}/><button type="button" aria-label={tr("Parolni ko‘rsatish", "Показать пароль", "Show password")} onClick={() => setShow(!show)}>{show ? <EyeOff/> : <Eye/>}</button></div></label>
      <label><span>{tr("Parolni takrorlang", "Повторите пароль", "Confirm password")}</span><div className="input-wrap"><LockKeyhole/><input type={show ? "text" : "password"} value={form.confirm} onChange={(event) => field("confirm", event.target.value)} autoComplete="new-password" placeholder={tr("Parolni takrorlang", "Повторите пароль", "Repeat password")} required minLength={8} maxLength={72}/></div></label>
      <label className="check terms"><input type="checkbox" checked={form.accept_terms} onChange={(event) => field("accept_terms", event.target.checked)} required/><span>{tr("Men", "Я принимаю", "I accept the")} <Link href="/terms">{tr("Foydalanish shartlari", "Условия использования", "Terms of use")}</Link> {tr("va", "и", "and")} <Link href="/privacy">{tr("Maxfiylik siyosati", "Политику конфиденциальности", "Privacy policy")}</Link></span></label>
      <button className="btn primary full large" disabled={loading}>{loading ? tr("Yaratilmoqda...", "Создание...", "Creating...") : tr("Ro‘yxatdan o‘tish", "Зарегистрироваться", "Create account")}</button>
    </form>
  </AuthShell>;
}
