"use client";
import Link from "next/link";
import { Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { api, ApiError, jsonBody } from "@/lib/api";

export default function ForgotPasswordPage() { const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [devToken, setDevToken] = useState(""); const [error, setError] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); setError(""); try { const result = await api<{message: string; dev_reset_token?: string}>("/auth/forgot-password", { method: "POST", ...jsonBody({ email }) }); setMessage(result.message); setDevToken(result.dev_reset_token ?? ""); } catch (err) { setError(err instanceof ApiError ? err.message : "Server bilan aloqa bo‘lmadi"); } } return <AuthShell title="Parolni tiklash" subtitle="Email manzilingizni kiriting" footer={<Link href="/login">Kirish sahifasiga qaytish</Link>}><form className="auth-form" onSubmit={submit}>{message && <div className="form-alert success">{message}{devToken && <><br/><Link href={`/reset-password?token=${devToken}`}>Development tiklash havolasi</Link></>}</div>}{error && <div className="form-alert error">{error}</div>}<label><span>Email</span><div className="input-wrap"><Mail/><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="siz@kompaniya.uz"/></div></label><button className="btn primary full large">Yo‘riqnoma yuborish</button></form></AuthShell>; }

