"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./logo";

export function PublicHeader() { const [open, setOpen] = useState(false); return <header className="public-header"><div className="public-nav"><Logo/><nav className={open ? "open" : ""} aria-label="Asosiy navigatsiya"><Link href="/#features" onClick={() => setOpen(false)}>Imkoniyatlar</Link><Link href="/#pricing" onClick={() => setOpen(false)}>Tariflar</Link><Link href="/#guide" onClick={() => setOpen(false)}>Qo‘llanma</Link><Link href="/#faq" onClick={() => setOpen(false)}>Savollar</Link></nav><div className="header-actions"><span className="language">UZ</span><Link className="btn ghost desktop-only" href="/login">Kirish</Link><Link className="btn primary desktop-only" href="/register">Bepul boshlash</Link><button className="icon-btn mobile-menu" aria-label="Menyuni ochish" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div></div></header>; }

