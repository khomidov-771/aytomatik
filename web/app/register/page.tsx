"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail, User } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { api, ApiError, jsonBody } from "@/lib/api";

type RegisterResult = {
  email_verification_required: boolean;
  dev_verification_token?: string;
  notice?: string;
};

export default function RegisterPage() {
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
      setError("Parollar bir xil emas");
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
      setError(requestError instanceof ApiError ? requestError.message : "Server bilan aloqa bo‘lmadi");
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return <AuthShell title="Emailni tasdiqlang" subtitle={`Tasdiqlash yo‘riqnomasi ${form.email} manziliga tayyorlandi`} footer={<Link href="/login">Kirish sahifasiga qaytish</Link>}>
      <div className="auth-form">
        <div className="form-alert success">Hisob yaratildi. Email tasdiqlanmaguncha kirish yopiq.</div>
        {verificationToken && <Link className="btn primary full large" href={`/verify-email?token=${encodeURIComponent(verificationToken)}`}>Development tasdiqlash havolasi</Link>}
        {!verificationToken && <p>Email xatidagi havolani oching. Havola 24 soat amal qiladi.</p>}
      </div>
    </AuthShell>;
  }

  return <AuthShell title="Ro‘yxatdan o‘tish" subtitle="Birinchi workspace’ingizni yarating" footer={<>Hisobingiz bormi? <Link href="/login">Kirish</Link></>}>
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="form-alert error">{error}</div>}
      <label><span>Ism</span><div className="input-wrap"><User/><input value={form.name} onChange={(event) => field("name", event.target.value)} autoComplete="name" placeholder="Farruxiddin" required minLength={2}/></div></label>
      <label><span>Email</span><div className="input-wrap"><Mail/><input type="email" value={form.email} onChange={(event) => field("email", event.target.value)} autoComplete="email" placeholder="siz@kompaniya.uz" required/></div></label>
      <label><span>Parol</span><div className="input-wrap"><LockKeyhole/><input type={show ? "text" : "password"} value={form.password} onChange={(event) => field("password", event.target.value)} autoComplete="new-password" placeholder="Kamida 8 belgi" required minLength={8} maxLength={72}/><button type="button" aria-label="Parolni ko‘rsatish" onClick={() => setShow(!show)}>{show ? <EyeOff/> : <Eye/>}</button></div></label>
      <label><span>Parolni takrorlang</span><div className="input-wrap"><LockKeyhole/><input type={show ? "text" : "password"} value={form.confirm} onChange={(event) => field("confirm", event.target.value)} autoComplete="new-password" placeholder="Parolni takrorlang" required minLength={8} maxLength={72}/></div></label>
      <label className="check terms"><input type="checkbox" checked={form.accept_terms} onChange={(event) => field("accept_terms", event.target.checked)} required/><span><Link href="/terms">Foydalanish shartlari</Link> va <Link href="/privacy">Maxfiylik siyosati</Link>ga roziman</span></label>
      <button className="btn primary full large" disabled={loading}>{loading ? "Yaratilmoqda..." : "Ro‘yxatdan o‘tish"}</button>
    </form>
  </AuthShell>;
}
