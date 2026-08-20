"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CasaPulseMark } from "@/components/casa-pulse-mark";
import { useCasaLocale } from "@/components/use-casa-locale";
import { authClient } from "@/lib/auth-client";

export function CasaEmpty() {
  const router = useRouter();
  const { locale, t, setLocale } = useCasaLocale();
  const [pending, setPending] = useState(false);

  return (
    <div className="casa-login">
      <header className="casa-login-top">
        <strong className="casa-brand" aria-label="Laro Pulse">
          <span className="casa-brand-mark" aria-hidden="true" />
          <span className="casa-brand-badge">
            <CasaPulseMark />
            Pulse
          </span>
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
        <h1>{t("home.emptyTitle")}</h1>
        <p className="casa-login-lead">{t("home.emptyLead")}</p>
        <button
          type="button"
          className="casa-login-back"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void authClient.signOut().then(() => {
              router.replace("/casa/entrar");
              router.refresh();
            });
          }}
        >
          {pending ? t("settings.signingOut") : t("settings.signOut")}
        </button>
      </div>
    </div>
  );
}
