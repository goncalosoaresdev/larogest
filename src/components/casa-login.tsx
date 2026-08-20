"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestOwnerOtp } from "@/app/casa/actions";
import { CasaPulseMark } from "@/components/casa-pulse-mark";
import { useCasaLocale } from "@/components/use-casa-locale";
import { authClient } from "@/lib/auth-client";
import {
  formatOtpCountdown,
  otpSecondsLeft,
  OWNER_OTP_TTL_MS,
  safeCasaNext,
} from "@/lib/owner-auth-core";

export function CasaLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useCasaLocale();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpLeft, setOtpLeft] = useState(0);
  const otpInput = useRef<HTMLInputElement>(null);
  const otpExpired = step === "code" && otpExpiresAt != null && otpLeft <= 0;

  useEffect(() => {
    if (step === "code") otpInput.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "code" || otpExpiresAt == null) return;
    const tick = () => setOtpLeft(otpSecondsLeft(otpExpiresAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [step, otpExpiresAt]);

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
    const expiresAt = Date.now() + OWNER_OTP_TTL_MS;
    setOtpExpiresAt(expiresAt);
    setOtpLeft(otpSecondsLeft(expiresAt, Date.now()));
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
    setOtpExpiresAt(null);
    setOtpLeft(0);
  }

  return (
    <div className="casa-stage">
      <div className="casa-device">
        <div className="casa-gate">
          <div className="casa-gate-art" aria-hidden="true">
            <img src="/casa-login-house.webp" alt="" />
          </div>

          <header className="casa-gate-top">
            <strong className="casa-brand casa-gate-brand" aria-label="Laro Pulse">
              <span className="casa-brand-mark" aria-hidden="true" />
              <span className="casa-brand-badge">
                <CasaPulseMark />
                Pulse
              </span>
            </strong>
          </header>

          <h1 className="casa-gate-headline">
            <span>{t("login.headline1")}</span>
            <span>{t("login.headline2")}</span>
            <span className="casa-gate-underline">{t("login.headline3")}</span>
          </h1>

          <div className="casa-gate-card">
            {step === "email" ? (
              <form onSubmit={onEmail}>
                <label className="casa-sr" htmlFor="casa-login-email">
                  {t("login.email")}
                </label>
                <div className="casa-gate-field">
                  <MailIcon />
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
                </div>
                {error ? <p className="casa-login-error">{error}</p> : null}
                <button type="submit" className="casa-gate-submit" disabled={pending}>
                  <span>{pending ? t("login.sending") : t("login.send")}</span>
                  <i className="casa-gate-arrow" aria-hidden="true">→</i>
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
                <label className="casa-sr" htmlFor="casa-login-otp">
                  {t("login.code")}
                </label>
                <div className="casa-gate-otp">
                  <input
                    ref={otpInput}
                    id="casa-login-otp"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="casa-gate-otp-input"
                    aria-describedby="casa-login-otp-hint"
                  />
                  <div className="casa-gate-otp-boxes" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => {
                      const digit = otp[index];
                      const active = index === Math.min(otp.length, 5);
                      return (
                        <span
                          key={index}
                          className={digit ? "is-filled" : active ? "is-on" : undefined}
                        >
                          {digit || (active ? <i /> : null)}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p
                  id="casa-login-otp-hint"
                  className={otpExpired ? "casa-gate-otp-hint is-expired" : "casa-gate-otp-hint"}
                  aria-live="polite"
                >
                  <ClockIcon />
                  {otpExpired
                    ? t("login.codeExpired")
                    : t("login.codeHint", { time: formatOtpCountdown(otpLeft) })}
                </p>
                {error ? <p className="casa-login-error">{error}</p> : null}
                <button type="submit" className="casa-gate-submit" disabled={pending || otpExpired || otp.length !== 6}>
                  <span>{pending ? t("login.verifying") : t("login.verify")}</span>
                  <i className="casa-gate-arrow" aria-hidden="true">→</i>
                </button>
                <button type="button" className="casa-login-back" onClick={backToEmail}>
                  {t("login.changeEmail")}
                </button>
              </form>
            )}
          </div>

          <p className="casa-gate-secure">
            <LockIcon />
            {t("login.secure")}
          </p>
        </div>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.2" y="5.5" width="17.6" height="13" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4 7.2 12 13l8-5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 8.4v4.1l2.6 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.2" y="10.4" width="11.6" height="9.2" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.6 10.4V8.3a3.4 3.4 0 0 1 6.8 0v2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.4" r="1.05" fill="currentColor" />
    </svg>
  );
}
