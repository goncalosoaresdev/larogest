"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestOwnerOtp } from "@/app/casa/actions";
import { useCasaLocale } from "@/components/use-casa-locale";
import { authClient } from "@/lib/auth-client";
import { safeCasaNext } from "@/lib/owner-auth-core";

export function CasaLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t, setLocale } = useCasaLocale();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  async function onEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setPreview(false);
    setPreviewCode(null);
    const result = await requestOwnerOtp(email);
    setPending(false);
    if (!result.ok) {
      setError(result.error === "rate_limit" ? t("login.rateLimit") : t("login.invalidEmail"));
      return;
    }
    if (result.preview) {
      setPreview(true);
      setPreviewCode(result.previewCode ?? null);
    }
    setStep("code");
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (result.error) {
      setError(t("login.invalidCode"));
      return;
    }
    router.push(safeCasaNext(searchParams.get("next")) || "/casa");
    router.refresh();
  }

  function backToEmail() {
    setStep("email");
    setOtp("");
    setError(null);
    setPreview(false);
    setPreviewCode(null);
  }

  return (
    <div className="casa-login">
      <header className="casa-login-top">
        <strong className="casa-brand" aria-label="Laro Pulse">
          <span className="casa-brand-mark" aria-hidden="true" />
          <span className="casa-brand-badge">Pulse</span>
        </strong>
        <div className="casa-login-langs" role="group" aria-label={t("settings.language")}>
          <button
            type="button"
            className={locale === "pt" ? "is-on" : undefined}
            aria-pressed={locale === "pt"}
            onClick={() => setLocale("pt")}
          >
            PT
          </button>
          <button
            type="button"
            className={locale === "en" ? "is-on" : undefined}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
        </div>
      </header>

      <div className="casa-login-card">
        <h1>{t("login.title")}</h1>
        <p className="casa-login-lead">{t("login.lead")}</p>

        {step === "email" ? (
          <form onSubmit={onEmail}>
            <label htmlFor="casa-login-email">{t("login.email")}</label>
            <input
              id="casa-login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("login.emailPlaceholder")}
            />
            {error ? <p className="casa-login-error">{error}</p> : null}
            <button type="submit" className="casa-login-submit" disabled={pending}>
              {pending ? t("login.sending") : t("login.send")}
            </button>
          </form>
        ) : (
          <form onSubmit={onCode}>
            <p className="casa-login-sent">{t("login.sent")}</p>
            {previewCode ? (
              <p className="casa-login-preview">{t("login.preview", { code: previewCode })}</p>
            ) : preview ? (
              <p className="casa-login-preview">{t("login.previewHint")}</p>
            ) : null}
            <label htmlFor="casa-login-otp">{t("login.code")}</label>
            <input
              id="casa-login-otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="casa-login-code"
              aria-describedby="casa-login-otp-hint"
            />
            <p id="casa-login-otp-hint" className="casa-login-hint">
              {t("login.codeHint")}
            </p>
            {error ? <p className="casa-login-error">{error}</p> : null}
            <button type="submit" className="casa-login-submit" disabled={pending || otp.length !== 6}>
              {pending ? t("login.verifying") : t("login.verify")}
            </button>
            <button type="button" className="casa-login-back" onClick={backToEmail}>
              {t("login.changeEmail")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
