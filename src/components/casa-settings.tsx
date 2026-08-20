"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { getCasaPushStatus, subscribeCasaPush, unsubscribeCasaPush, type CasaPushStatus } from "@/lib/casa-push-client";
import { DEFAULT_CASA_NOTIFY, parseClockMinutes, type CasaNotifyPrefs } from "@/lib/casa-notify-types";
import { casaText, isPushErrorKey, type CasaLocale } from "@/lib/casa-locale";
import { useCasaLocale } from "@/components/use-casa-locale";
import { authClient } from "@/lib/auth-client";

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
const WHEEL_ITEM = 28;
const WHEEL_PAD = 21;
const WHEEL_H = WHEEL_ITEM + WHEEL_PAD * 2;

export function CasaSettings({ siteId, canSignOut = true }: { siteId: string; canSignOut?: boolean }) {
  const [prefs, setPrefs] = useState<CasaNotifyPrefs>(DEFAULT_CASA_NOTIFY);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pushState, setPushState] = useState<CasaPushStatus>("hidden");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { locale, t, setLocale } = useCasaLocale();
  const router = useRouter();

  useEffect(() => {
    setPushState(getCasaPushStatus());
    let cancelled = false;
    void fetch(`/api/casa/${siteId}/notify`)
      .then((response) => {
        if (!response.ok) throw new Error("notify");
        return response.json() as Promise<CasaNotifyPrefs>;
      })
      .then((next) => {
        if (!cancelled) {
          setPrefs(next);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  async function save(on: boolean) {
    const previous = prefs;
    setPrefs({ ...prefs, push: on });
    setBusy(true);
    setNote(null);
    try {
      if (on) {
        const result = await subscribeCasaPush();
        setPushState(getCasaPushStatus());
        if (!result.ok) setNote(translatePushError(locale, result.error, result.host));
      }
      const response = await fetch(`/api/casa/${siteId}/notify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push: on }),
      });
      if (!response.ok) throw new Error("save");
      setPrefs((await response.json()) as CasaNotifyPrefs);
      if (!on) {
        try {
          await unsubscribeCasaPush();
          setPushState(getCasaPushStatus());
        } catch {
          // Prefs already saved off; drop the browser subscription next time.
        }
      }
    } catch {
      setPrefs(previous);
    } finally {
      setBusy(false);
    }
  }

  async function patch(next: Partial<CasaNotifyPrefs>) {
    const previous = prefs;
    setPrefs({ ...prefs, ...next });
    setBusy(true);
    try {
      const response = await fetch(`/api/casa/${siteId}/notify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("save");
      setPrefs((await response.json()) as CasaNotifyPrefs);
    } catch {
      setPrefs(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="casa-pane">
      <h2>{t("settings.title")}</h2>
      <p className="casa-pane-lead">{t("settings.lead")}</p>

      {status === "error" ? <p className="casa-history-empty">{t("settings.loadError")}</p> : null}

      <section className="casa-settings">
        <h3>{t("settings.language")}</h3>
        <LanguageSwitch locale={locale} onChange={setLocale} label={t("settings.language")} />
      </section>

      <section className="casa-settings">
        <h3>{t("settings.notifications")}</h3>
        {pushState === "ios" ? <p className="casa-settings-note">{t("settings.ios")}</p> : null}
        {note ? <p className="casa-settings-note">{note}</p> : null}
        <button
          type="button"
          className="casa-setting"
          disabled={busy || status !== "ready"}
          onClick={() => void save(!prefs.push)}
        >
          <span>
            <strong>{t("settings.push")}</strong>
            <small>{t("settings.pushHint")}</small>
          </span>
          <i className={`casa-switch${prefs.push ? " is-on" : ""}`} aria-hidden="true" />
        </button>
      </section>

      <section className="casa-settings">
        <h3>{t("settings.quiet")}</h3>
        <button
          type="button"
          className="casa-setting"
          disabled={busy || status !== "ready" || !prefs.push}
          onClick={() => void patch({ quietEnabled: !prefs.quietEnabled })}
        >
          <span>
            <strong>{t("settings.dnd")}</strong>
            <small>{t("settings.dndHint")}</small>
          </span>
          <i className={`casa-switch${prefs.quietEnabled ? " is-on" : ""}`} aria-hidden="true" />
        </button>
        {prefs.quietEnabled ? (
          <QuietHoursPicker
            start={prefs.quietStart}
            end={prefs.quietEnd}
            disabled={busy || status !== "ready"}
            onChange={(next) => void patch(next)}
          />
        ) : null}
      </section>

      {canSignOut ? (
        <section className="casa-settings">
          <h3>{t("settings.account")}</h3>
          <button
            type="button"
            className="casa-setting"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void authClient.signOut().then(() => {
                router.replace("/casa/entrar");
                router.refresh();
              });
            }}
          >
            <span>
              <strong>{busy ? t("settings.signingOut") : t("settings.signOut")}</strong>
            </span>
          </button>
        </section>
      ) : null}
    </div>
  );
}

const LANGS: { id: CasaLocale; mark: string; name: string }[] = [
  { id: "pt", mark: "PT", name: "Português" },
  { id: "en", mark: "EN", name: "English" },
];

function LanguageSwitch({
  locale,
  onChange,
  label,
}: {
  locale: CasaLocale;
  onChange: (next: CasaLocale) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={langTrack}
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        onChange(locale === "pt" ? "en" : "pt");
      }}
    >
      {LANGS.map((lang) => {
        const on = locale === lang.id;
        return (
          <button
            key={lang.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(lang.id)}
            style={on ? langCardOn : langCard}
          >
            <span style={on ? langMarkOn : langMark}>{lang.mark}</span>
            <span style={langName}>{lang.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const langTrack: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  alignItems: "stretch",
  width: "100%",
  gap: 4,
  margin: 0,
  padding: 0,
  borderRadius: 10,
  background: "transparent",
};
const langCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 6,
  height: 36,
  width: "100%",
  minWidth: 0,
  padding: "0 10px",
  border: 0,
  borderRadius: 10,
  background: "rgba(41, 67, 55, 0.055)",
  color: "#294337",
  font: "inherit",
  boxSizing: "border-box",
  transition: "background 0.18s ease, color 0.18s ease",
};
const langCardOn: CSSProperties = {
  ...langCard,
  background: "#294337",
  color: "#fffefa",
};
const langMark: CSSProperties = {
  flex: "none",
  width: 18,
  color: "#5e7165",
  fontSize: 11,
  fontWeight: 650,
  letterSpacing: "0.06em",
  lineHeight: 1,
};
const langMarkOn: CSSProperties = {
  ...langMark,
  color: "rgba(255, 254, 250, 0.62)",
};
const langName: CSSProperties = {
  fontSize: 13,
  fontWeight: 590,
  letterSpacing: "-0.03em",
  lineHeight: 1,
};

function translatePushError(locale: CasaLocale, error?: string, host?: string) {
  if (!error) return null;
  if (isPushErrorKey(error)) return casaText(locale, error, host ? { host } : undefined);
  return error;
}

function QuietHoursPicker({
  start,
  end,
  disabled,
  onChange,
}: {
  start: string;
  end: string;
  disabled?: boolean;
  onChange: (next: { quietStart?: string; quietEnd?: string }) => void;
}) {
  const { t } = useCasaLocale();
  const hours = quietLength(start, end);
  const spans = quietSpans(start, end);

  return (
    <div className="casa-quiet" style={quietBox}>
      <div style={quietRow} aria-disabled={disabled}>
        <HourWheel
          label={t("settings.from")}
          value={hourValue(start)}
          disabled={disabled}
          onChange={(hour) => onChange({ quietStart: hour })}
        />
        <HourWheel
          label={t("settings.to")}
          value={hourValue(end)}
          disabled={disabled}
          onChange={(hour) => onChange({ quietEnd: hour })}
        />
      </div>
      <div style={quietMeter}>
        <div className="casa-quiet-track" style={quietTrack} aria-hidden="true">
          {spans.map((span) => (
            <i key={`${span.left}-${span.width}`} style={{ ...quietSpan, left: `${span.left}%`, width: `${span.width}%` }} />
          ))}
        </div>
        <p style={quietFoot}>{hours === 1 ? t("settings.hour") : t("settings.hours", { n: hours })}</p>
      </div>
    </div>
  );
}

function HourWheel({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (hour: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const ignore = useRef(true);
  const timer = useRef(0);
  const index = Math.max(0, HOURS.indexOf(value));

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.style.setProperty("overflow-x", "hidden");
    node.style.setProperty("overflow-y", "auto");
    ignore.current = true;
    node.scrollTop = index * WHEEL_ITEM;
    const id = window.setTimeout(() => {
      ignore.current = false;
    }, 80);
    return () => window.clearTimeout(id);
  }, [index]);

  function settle() {
    const node = scroller.current;
    if (!node || ignore.current || disabled) return;
    const next = HOURS[Math.min(23, Math.max(0, Math.round(node.scrollTop / WHEEL_ITEM)))];
    if (next && next !== value) onChange(next);
  }

  return (
    <div style={quietCol}>
      <span style={quietLabel}>{label}</span>
      <div
        ref={scroller}
        className="casa-quiet-wheel"
        aria-label={label}
        style={quietWheel}
        onScroll={() => {
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(settle, 90);
        }}
      >
        {HOURS.map((hour) => (
          <div key={hour} style={hour === value ? quietHourOn : quietHour}>
            {hour}
          </div>
        ))}
      </div>
    </div>
  );
}

const quietBox: CSSProperties = {
  marginTop: 4,
  padding: "8px 10px 10px",
  borderRadius: 12,
  background: "rgba(41, 67, 55, 0.035)",
};
const quietRow: CSSProperties = {
  display: "flex",
  gap: 8,
};
const quietCol: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
};
const quietLabel: CSSProperties = {
  display: "block",
  marginBottom: 2,
  color: "#5e7165",
  fontSize: 9,
  fontWeight: 650,
  letterSpacing: "0.12em",
  textAlign: "center",
  textTransform: "uppercase",
};
const quietWheel: CSSProperties = {
  height: WHEEL_H,
  maxHeight: WHEEL_H,
  minHeight: 0,
  paddingTop: WHEEL_PAD,
  paddingBottom: WHEEL_PAD,
  overflow: "auto",
  scrollSnapType: "y mandatory",
  scrollbarWidth: "none",
  WebkitOverflowScrolling: "touch",
  background:
    "linear-gradient(transparent, transparent 21px, rgba(41, 67, 55, 0.055) 21px, rgba(41, 67, 55, 0.055) 49px, transparent 49px)",
};
const quietHour: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: WHEEL_ITEM,
  flex: "none",
  color: "#9aa198",
  fontSize: 15,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.03em",
  scrollSnapAlign: "center",
};
const quietHourOn: CSSProperties = {
  ...quietHour,
  color: "#294337",
  fontWeight: 600,
};
const quietMeter: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 8,
  padding: "0 2px",
};
const quietTrack: CSSProperties = {
  position: "relative",
  flex: 1,
  height: 4,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(41, 67, 55, 0.08)",
};
const quietSpan: CSSProperties = {
  position: "absolute",
  top: 0,
  height: "100%",
  borderRadius: 999,
  background: "#294337",
};
const quietFoot: CSSProperties = {
  margin: 0,
  color: "#737970",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

function hourValue(value: string) {
  const minutes = parseClockMinutes(value);
  if (minutes == null) return "22:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
}

function quietLength(start: string, end: string) {
  const from = parseClockMinutes(hourValue(start));
  const to = parseClockMinutes(hourValue(end));
  if (from == null || to == null) return 0;
  if (from === to) return 24;
  return from < to ? (to - from) / 60 : (24 * 60 - from + to) / 60;
}

function quietSpans(start: string, end: string) {
  const from = parseClockMinutes(hourValue(start));
  const to = parseClockMinutes(hourValue(end));
  if (from == null || to == null) return [];
  const a = (from / (24 * 60)) * 100;
  const b = (to / (24 * 60)) * 100;
  if (from === to) return [{ left: 0, width: 100 }];
  if (from < to) return [{ left: a, width: b - a }];
  return [
    { left: a, width: 100 - a },
    { left: 0, width: b },
  ];
}
