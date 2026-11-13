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
    <nav id="public-menu" className={open ? "open" : ""} aria-label={tr("Asosiy navigatsiya", "Основная навигация", "Main navigation")}>
      <Link href="/#product" onClick={() => setOpen(false)}>{tr("Mahsulot", "Продукт", "Product")}</Link>
      <Link href="/#features" onClick={() => setOpen(false)}>{tr("Imkoniyatlar", "Возможности", "Features")}</Link>
      <Link href="/#guide" onClick={() => setOpen(false)}>{tr("Qanday ishlaydi?", "Как это работает?", "How it works")}</Link>
      <Link href="/#help" onClick={() => setOpen(false)}>{tr("Yordam", "Помощь", "Help")}</Link>
      <Link className="public-nav-auth mobile-auth-link" href="/login" onClick={() => setOpen(false)}>{tr("Kirish", "Войти", "Sign in")}</Link>
      <Link className="public-nav-auth mobile-auth-link" href="/register" onClick={() => setOpen(false)}>{tr("Ro‘yxatdan o‘tish", "Регистрация", "Create account")}</Link>
    </nav>
    <div className="header-actions">
      <PreferencesControls compact />
      <Link className="btn secondary desktop-only" href="/login">{tr("Kirish", "Войти", "Sign in")}</Link>
      <Link className="btn primary desktop-only" href="/register">{tr("Ro‘yxatdan o‘tish", "Регистрация", "Create account")}</Link>
      <button className="icon-btn mobile-menu" aria-label={open ? tr("Menyuni yopish", "Закрыть меню", "Close menu") : tr("Menyuni ochish", "Открыть меню", "Open menu")} aria-expanded={open} aria-controls="public-menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div>
  </div></header>;
}

