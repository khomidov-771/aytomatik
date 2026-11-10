"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./logo";
import { PreferencesControls, usePreferences } from "./preferences-provider";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { tr } = usePreferences();

  return <header className="public-header"><div className="public-nav">
    <Logo />
    <nav className={open ? "open" : ""} aria-label={tr("Asosiy navigatsiya", "Основная навигация", "Main navigation")}>
      <Link href="/#features" onClick={() => setOpen(false)}>{tr("Imkoniyatlar", "Возможности", "Features")}</Link>
      <Link href="/#guide" onClick={() => setOpen(false)}>{tr("Qanday ishlaydi", "Как это работает", "How it works")}</Link>
      <Link href="/#safety" onClick={() => setOpen(false)}>{tr("Xavfsizlik", "Безопасность", "Security")}</Link>
    </nav>
    <div className="header-actions">
      <PreferencesControls compact />
      <Link className="btn ghost desktop-only" href="/login">{tr("Kirish", "Войти", "Sign in")}</Link>
      <Link className="btn primary desktop-only" href="/register">{tr("Boshlash", "Начать", "Get started")}</Link>
      <button className="icon-btn mobile-menu" aria-label={tr("Menyuni ochish", "Открыть меню", "Open menu")} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div>
  </div></header>;
}
