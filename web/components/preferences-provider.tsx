"use client";

import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SelectMenu } from "./select-menu";

export type Locale = "uz" | "ru" | "en";
export type Theme = "light" | "dark";

type PreferencesContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  tr: (uz: string, ru: string, en: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === "uz" || value === "ru" || value === "en";
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("uz");
  const [theme, updateTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("ids-locale");
    const storedTheme = window.localStorage.getItem("ids-theme");
    const preferredTheme: Theme = isTheme(storedTheme)
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const timer = window.setTimeout(() => {
      if (isLocale(storedLocale)) updateLocale(storedLocale);
      updateTheme(preferredTheme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `ids_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.localStorage.setItem("ids-locale", locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("ids-theme", theme);
  }, [theme]);

  const value = useMemo<PreferencesContextValue>(() => ({
    locale,
    setLocale: updateLocale,
    theme,
    setTheme: updateTheme,
    tr: (uz, ru, en) => locale === "ru" ? ru : locale === "en" ? en : uz,
  }), [locale, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}

export function PreferencesControls({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, theme, setTheme, tr } = usePreferences();
  const languageOptions = [
    { value: "uz" as const, label: compact ? "UZ" : "O‘zbekcha", description: compact ? "O‘zbekcha" : undefined },
    { value: "ru" as const, label: compact ? "RU" : "Русский", description: compact ? "Русский" : undefined },
    { value: "en" as const, label: compact ? "EN" : "English", description: compact ? "English" : undefined },
  ];
  return <div className={`preferences-controls ${compact ? "compact" : ""}`}>
    <SelectMenu value={locale} options={languageOptions} onChange={setLocale} ariaLabel={tr("Til", "Язык", "Language")} compact={compact} align="right" className="locale-control" />
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === "dark" ? tr("Yorug‘ rejim", "Светлая тема", "Light mode") : tr("Tungi rejim", "Тёмная тема", "Dark mode")}
      title={theme === "dark" ? tr("Yorug‘ rejim", "Светлая тема", "Light mode") : tr("Tungi rejim", "Тёмная тема", "Dark mode")}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  </div>;
}
