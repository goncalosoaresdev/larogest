"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getCasaPushStatus, subscribeCasaPush, type CasaPushStatus } from "@/lib/casa-push-client";
import { useCasaLocale } from "@/components/use-casa-locale";

export function CasaPushEnable({ token }: { token: string }) {
  const { t } = useCasaLocale();
  const detected = useSyncExternalStore(subscribe, getCasaPushStatus, () => "hidden" as CasaPushStatus);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (detected !== "granted") return;
    let cancelled = false;
    void subscribeCasaPush(token).then((result) => {
      if (!cancelled && result.ok) setSubscribed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [detected, token]);

  if (detected === "hidden" || subscribed) return null;

  if (detected === "ios") {
    return <p className="casa-push">{t("push.ios")}</p>;
  }

  if (detected === "denied") {
    return <p className="casa-push">{t("push.denied")}</p>;
  }

  if (detected === "granted") return null;

  return (
    <button
      type="button"
      className="casa-push is-action"
      onClick={() =>
        void subscribeCasaPush(token).then((result) => {
          if (result.ok) setSubscribed(true);
        })
      }
    >
      {t("push.enable")}
    </button>
  );
}

function subscribe() {
  return () => undefined;
}
