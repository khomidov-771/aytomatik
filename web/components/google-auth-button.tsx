"use client";

import { useEffect, useState } from "react";
import { usePreferences } from "./preferences-provider";
import { api, ApiError, jsonBody } from "@/lib/api";

type Intent = "login" | "register";
type Status = "loading" | "ready" | "disabled" | "error";

function callbackError(code: string, tr: (uz: string, ru: string, en: string) => string) {
  switch (code) {
    case "cancelled": return tr("Google orqali kirish bekor qilindi.", "Вход через Google отменён.", "Google sign-in was cancelled.");
    case "account_not_found": return tr("Bu Google hisobi hali ro‘yxatdan o‘tmagan. Hisob yaratish uchun Google orqali ro‘yxatdan o‘ting.", "Этот аккаунт Google ещё не зарегистрирован. Создайте аккаунт через регистрацию Google.", "This Google account is not registered yet. Create an account using Google sign-up.");
    case "account_conflict": return tr("Bu Google hisobi boshqa profilga bog‘langan. Yordam xizmatiga murojaat qiling.", "Этот аккаунт Google связан с другим профилем. Обратитесь в поддержку.", "This Google account is linked to a different profile. Contact support.");
    case "identity_not_verified": return tr("Google email manzili tasdiqlanmadi. Boshqa hisob bilan urinib ko‘ring.", "Email Google не подтверждён. Попробуйте другой аккаунт.", "Google did not verify this email address. Try another account.");
    case "invalid_state": return tr("Kirish havolasi eskirgan yoki xavfsizlik tekshiruvidan o‘tmadi. Qayta urinib ko‘ring.", "Ссылка входа устарела или не прошла проверку безопасности. Попробуйте снова.", "The sign-in request expired or failed a security check. Please try again.");
    case "google_unavailable": return tr("Google orqali kirish hozir sozlanmagan.", "Вход через Google сейчас не настроен.", "Google sign-in is not configured right now.");
    default: return tr("Google orqali kirib bo‘lmadi. Qayta urinib ko‘ring.", "Не удалось войти через Google. Попробуйте снова.", "Google sign-in could not be completed. Please try again.");
  }
}

export function GoogleAuthButton({ intent, acceptTerms = false, rememberMe = false }: { intent: Intent; acceptTerms?: boolean; rememberMe?: boolean }) {
  const { tr } = usePreferences();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [callbackCode, setCallbackCode] = useState("");

  useEffect(() => {
    let active = true;
    void api<{ enabled: boolean }>("/auth/google/status")
      .then((result) => { if (active) setStatus(result.enabled ? "ready" : "disabled"); })
      .catch(() => { if (active) setStatus("error"); });

    const params = new URLSearchParams(window.location.search);
    const callbackCode = params.get("google_error");
    if (callbackCode) {
      const timer = window.setTimeout(() => { if (active) setCallbackCode(callbackCode); }, 0);
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
      return () => { active = false; window.clearTimeout(timer); };
    }
    return () => { active = false; };
  }, [tr]);

  async function start() {
    setBusy(true);
    setError("");
    setCallbackCode("");
    try {
      const result = await api<{ authorization_url: string }>("/auth/google/start", {
        method: "POST",
        ...jsonBody({ intent, accept_terms: acceptTerms, remember_me: rememberMe }),
      });
      window.location.assign(result.authorization_url);
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : tr("Server bilan aloqa bo‘lmadi", "Нет связи с сервером", "Could not reach the server"));
      setBusy(false);
    }
  }

  const buttonLabel = status === "loading"
    ? tr("Google sozlamasi tekshirilmoqda…", "Проверяем настройки Google…", "Checking Google sign-in…")
    : status === "ready"
      ? (busy ? tr("Google’ga ulanmoqda…", "Подключение к Google…", "Connecting to Google…") : tr("Google bilan davom etish", "Продолжить с Google", "Continue with Google"))
      : status === "error"
        ? tr("Google xizmati vaqtincha tekshirilmadi", "Не удалось проверить Google", "Google sign-in could not be checked")
        : tr("Google orqali kirish sozlanmagan", "Вход через Google не настроен", "Google sign-in is not configured");

  return <>
    <div className="auth-divider"><span>{tr("yoki", "или", "or")}</span></div>
    <button className="btn secondary full google-auth-button" type="button" disabled={status !== "ready" || busy || (intent === "register" && !acceptTerms)} onClick={() => void start()}>
      <span className="google-mark" aria-hidden="true">G</span>{buttonLabel}
    </button>
    {status === "disabled" && <p className="auth-google-note">{tr("Administrator Google OAuth Client ID va Secret qiymatlarini serverda sozlagandan keyin bu usul yoqiladi.", "Этот способ станет доступен после настройки Google OAuth Client ID и Secret на сервере.", "An administrator must configure the Google OAuth Client ID and Secret on the server before this option can be used.")}</p>}
    {intent === "register" && !acceptTerms && status === "ready" && <p className="auth-google-note">{tr("Google orqali hisob yaratishdan oldin shartlarni qabul qiling.", "Примите условия перед созданием аккаунта через Google.", "Accept the terms before creating an account with Google.")}</p>}
    {(error || callbackCode) && <div className="form-alert error" role="alert">{error || callbackError(callbackCode, tr)}</div>}
  </>;
}
