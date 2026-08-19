"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PulseSample } from "@prisma/client";
import type { CasaOwnerAlert, CasaOwnerDevice } from "@/lib/casa";
import { format, startOfDay } from "date-fns";
import { CasaTodayChart } from "@/components/casa-today-chart";
import { pulseDeviceSeverity } from "@/lib/pulse";
import { CasaPushEnable } from "@/components/casa-push-enable";
import { CasaSettings } from "@/components/casa-settings";
import { useCasaLocale } from "@/components/use-casa-locale";
import type { CasaHistoryCursor, CasaHistorySample } from "@/lib/casa-history";
import type { CasaLive } from "@/lib/casa";
import {
  casaAlertTypeLabel,
  casaDateLocale,
  casaFnsLocale,
  casaHeadline,
  casaHeadlineKind,
  casaHistoryDay,
  casaHouseTitle,
  casaRelativeTime,
  casaText,
  type CasaLocale,
  type CasaTextKey,
} from "@/lib/casa-locale";

const WHATSAPP = "https://wa.me/351931063911";

type Tab = "casa" | "historico" | "alertas" | "laro" | "definicoes";
type Tone = "ok" | "warn" | "alert" | "offline" | "idle";

const TABS: Tab[] = ["casa", "historico", "alertas", "laro"];
const LIVE_MS = 60_000;

type CasaHouseLink = {
  token: string;
  name: string;
  address: string;
  city: string | null;
};

export function CasaPulseView({
  ownerName,
  address,
  city,
  devices,
  alerts,
  samples = [],
  now,
  token,
  houses = [],
}: {
  ownerName: string;
  address: string;
  city: string | null;
  devices: CasaOwnerDevice[];
  alerts: CasaOwnerAlert[];
  samples?: PulseSample[];
  now: string;
  token: string;
  houses?: CasaHouseLink[];
}) {
  const [tab, setTab] = useState<Tab>("casa");
  const [scrolled, setScrolled] = useState(false);
  const [live, setLive] = useState({ devices, alerts, samples, now });
  const screen = useRef<HTMLElement>(null);
  const { locale, t } = useCasaLocale();
  const clock = new Date(live.now);
  const sensors = live.devices.filter((device) => device.kind !== "GATEWAY");
  const openAlerts = live.alerts.filter((alert) => alert.status === "OPEN");
  const headline = casaHeadline(locale, live.devices, openAlerts.length);
  const tone = houseTone(live.devices, openAlerts.length, sensors);
  const propertyName = casaHouseTitle(locale, city, address);
  const givenName = firstName(ownerName);
  const tiles = ownerTiles(sensors, locale);

  useEffect(() => {
    setLive({ devices, alerts, samples, now });
  }, [token]);

  useEffect(() => {
    if (tab !== "casa" && tab !== "alertas") return;
    let cancelled = false;
    let timer = 0;

    async function pull() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/casa/${token}/live`);
        if (!response.ok || cancelled) return;
        const next = (await response.json()) as CasaLive;
        if (cancelled) return;
        setLive({
          devices: next.devices,
          alerts: next.alerts,
          samples: next.samples,
          now: next.now,
        });
      } catch {
        // keep the last good frame
      }
    }

    async function loop() {
      await pull();
      if (!cancelled) timer = window.setTimeout(loop, LIVE_MS);
    }

    void loop();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tab, token]);

  useEffect(() => {
    const node = screen.current;
    if (!node) return;
    node.scrollTop = 0;
    setScrolled(false);
    const onScroll = () => setScrolled(node.scrollTop > 8);
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [tab]);

  return (
    <div className="casa-stage">
      <a className="casa-skip" href="#ecra">
        {t("skip")}
      </a>
      <div className="casa-device">
        <div className="casa-shell">
          <header className={`casa-appbar${scrolled ? " is-scrolled" : ""}`}>
            <strong className="casa-brand" aria-label="Laro Pulse">
              <span className="casa-brand-mark" aria-hidden="true" />
              <span className="casa-brand-badge">Pulse</span>
            </strong>
            <CasaPlaceSwitch currentToken={token} propertyName={propertyName} houses={houses} />
            <div className="casa-account">
              <button
                type="button"
                className="casa-bell-btn"
                aria-label={
                  openAlerts.length
                    ? openAlerts.length === 1
                      ? t("alerts.count.one")
                      : t("alerts.count.many", { n: openAlerts.length })
                    : t("alerts.none")
                }
                onClick={() => setTab("alertas")}
              >
                <IconBell />
                {openAlerts.length ? <i className="casa-pip" /> : null}
              </button>
              <button
                type="button"
                className={`casa-gear-btn${tab === "definicoes" ? " is-on" : ""}`}
                aria-label={t("settings.aria")}
                aria-pressed={tab === "definicoes"}
                onClick={() => setTab("definicoes")}
              >
                <IconGear />
              </button>
            </div>
          </header>

          <main id="ecra" ref={screen} className="casa-screen" data-tone={tone}>
            <div key={tab} className="casa-swap">
              {tab === "casa" ? (
                <HomePane
                  headline={headline}
                  propertyName={propertyName}
                  ownerName={givenName}
                  sensorCount={sensors.length}
                  tiles={tiles}
                  tone={tone}
                  devices={sensors}
                  alerts={live.alerts}
                  samples={live.samples}
                  now={clock}
                />
              ) : null}
              {tab === "historico" ? <HistoryPane token={token} devices={sensors} now={clock} /> : null}
              {tab === "alertas" ? <AlertsPane alerts={live.alerts} token={token} /> : null}
              {tab === "laro" ? <LaroPane tone={tone} token={token} /> : null}
              {tab === "definicoes" ? <CasaSettings token={token} /> : null}
            </div>
          </main>

          <nav
            className="casa-tabbar"
            aria-label={t("nav")}
            style={{ "--tab": Math.max(0, TABS.indexOf(tab)) } as CSSProperties}
          >
            {TABS.includes(tab) ? <span className="casa-tab-pill" aria-hidden="true" /> : null}
            <TabButton active={tab === "casa"} label={t("tab.home")} onSelect={() => setTab("casa")}>
              <IconHome />
            </TabButton>
            <TabButton active={tab === "historico"} label={t("tab.history")} onSelect={() => setTab("historico")}>
              <IconHistory />
            </TabButton>
            <TabButton
              active={tab === "alertas"}
              badge={openAlerts.length}
              label={t("tab.alerts")}
              onSelect={() => setTab("alertas")}
            >
              <IconBell />
            </TabButton>
            <TabButton active={tab === "laro"} label={t("tab.laro")} onSelect={() => setTab("laro")}>
              <IconMark />
            </TabButton>
          </nav>
        </div>
      </div>
    </div>
  );
}

function CasaPlaceSwitch({
  currentToken,
  propertyName,
  houses,
}: {
  currentToken: string;
  propertyName: string;
  houses: CasaHouseLink[];
}) {
  const { locale, t } = useCasaLocale();
  const [open, setOpen] = useState(false);
  const canSwitch = houses.length > 1;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!canSwitch) {
    return (
      <p className="casa-place" aria-label={t("house.selected", { name: propertyName })}>
        <span>{propertyName}</span>
      </p>
    );
  }

  return (
    <div className="casa-place-wrap">
      <button
        type="button"
        className={`casa-place${open ? " is-open" : ""}`}
        aria-label={t("house.choose", { name: propertyName })}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{propertyName}</span>
        <IconChevron />
      </button>
      {open ? (
        <>
          <button type="button" className="casa-place-scrim" aria-label={t("house.close")} onClick={() => setOpen(false)} />
          <ul className="casa-place-menu" role="listbox" aria-label={t("house.list")}>
            {houses.map((house) => {
              const current = house.token === currentToken;
              const name = casaHouseTitle(locale, house.city, house.address);
              return (
                <li key={house.token}>
                  <Link
                    href={`/casa/${house.token}`}
                    role="option"
                    aria-selected={current}
                    className={current ? "is-current" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <strong>{name}</strong>
                    {house.address && house.address !== name ? <small>{house.address}</small> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  badge = 0,
  children,
  label,
  onSelect,
}: {
  active: boolean;
  badge?: number;
  children: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`casa-tab${active ? " is-active" : ""}`}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
    >
      <span className="casa-tab-icon">
        {children}
        {badge > 0 ? <span className="casa-tab-badge">{badge}</span> : null}
      </span>
    </button>
  );
}

function HomePane({
  headline,
  propertyName,
  ownerName,
  sensorCount,
  tiles,
  tone,
  devices,
  alerts,
  samples,
  now,
}: {
  headline: string;
  propertyName: string;
  ownerName: string;
  sensorCount: number;
  tiles: OwnerTile[];
  tone: Tone;
  devices: CasaOwnerDevice[];
  alerts: CasaOwnerAlert[];
  samples: PulseSample[];
  now: Date;
}) {
  const { locale, t } = useCasaLocale();
  const chips = orbitChips(tiles);
  const hour = lisbonHour(now);
  const part = dayPart(hour);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const selectedSensor = chips.find((chip) => chip.id === selectedSensorId) ?? null;
  const sub =
    tone === "alert"
      ? t("hub.laroAlerted")
      : tone === "warn"
        ? t("hub.laroWatching")
        : tone === "offline"
          ? t("hub.offline")
          : sensorCount === 0
            ? t("hub.noReading")
            : t("hub.watched");

  return (
    <>
      <p className="casa-hello" data-part={part}>
        <span className="casa-hello-when">{dayWhen(part, locale)}</span>
        {ownerName ? <span className="casa-hello-name">{ownerName}</span> : null}
      </p>
      <section className="casa-spatial" aria-label={t("home.state")}>
        <div className="casa-topo" aria-hidden="true" />
        <Image
          className="casa-plan-image"
          src="/casa-floorplan-v4.png"
          alt={t("home.floorplan")}
          fill
          priority
          sizes="(max-width: 640px) 100vw, 576px"
        />
        <div className="casa-orbit" aria-hidden="true" />
        <div className="casa-hub" aria-label={`${headline}. ${sub}`}>
          <i className="casa-wave" aria-hidden="true" />
          <i className="casa-wave" aria-hidden="true" />
          <i className="casa-wave" aria-hidden="true" />
          <span aria-hidden="true">{tone === "ok" || tone === "idle" ? "✓" : "!"}</span>
        </div>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="casa-chip"
            data-slot={chip.slot}
            data-tone={chip.tone}
            data-kind={chip.kind}
            data-battery={batteryLow(chip.batteryPct) ? "low" : undefined}
            aria-expanded={selectedSensor?.id === chip.id}
            aria-label={chipAriaLabel(chip, locale)}
            onClick={() => setSelectedSensorId((current) => current === chip.id ? null : chip.id)}
          >
            <span className="casa-chip-icon">{metricIcon(chip.kind)}</span>
            <span className="casa-chip-copy">
              <small>{chip.label}</small>
              <strong>{sensorDisplayValue(chip, locale)}</strong>
            </span>
          </button>
        ))}
      </section>

      {selectedSensor ? (
        <SensorDetail sensor={selectedSensor} onClose={() => setSelectedSensorId(null)} />
      ) : null}

      <div className="casa-home-deck">
        <CasaTodayChart devices={devices} alerts={alerts} samples={samples} now={now} />
        <div className="casa-deck-divider" aria-hidden="true" />
        <AskLaro propertyName={propertyName} headline={headline} tone={tone} />
      </div>
    </>
  );
}

function AskLaro({
  propertyName,
  headline,
  tone,
}: {
  propertyName: string;
  headline: string;
  tone: Tone;
}) {
  const { locale, t } = useCasaLocale();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const suggestions = askSuggestions(tone, locale);
  const invitation = t(`ask.invite.${tone}` as CasaTextKey);
  const ready = note.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    field.current?.focus({ preventScroll: true });
    const screen = composer.current?.closest(".casa-screen");
    const frame = window.requestAnimationFrame(() => {
      screen?.scrollTo({ top: screen.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function send(text = note) {
    const body = text.trim();
    if (!body) return;
    const message = `${propertyName}\n${t("ask.state")}: ${headline}\n\n${body}`;
    window.open(`${WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  if (!open) {
    return (
      <button
        type="button"
        className="casa-ask"
        data-tone={tone}
        aria-expanded="false"
        aria-controls="casa-ask-composer"
        onClick={() => setOpen(true)}
      >
        <span className="casa-ask-mark" aria-hidden="true">
          <IconWhatsApp />
          <i />
        </span>
        <span className="casa-ask-copy">
          <strong>{t("ask.talk")}</strong>
          <small>{invitation}</small>
        </span>
        <span className="casa-ask-cta" aria-hidden="true">
          <IconSend />
        </span>
      </button>
    );
  }

  return (
    <form
      ref={composer}
      id="casa-ask-composer"
      className="casa-ask is-open"
      data-tone={tone}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="casa-ask-toolbar">
        <span className="casa-ask-mark" aria-hidden="true">
          <IconWhatsApp />
          <i />
        </span>
        <span className="casa-ask-copy">
          <span className="casa-ask-kicker">{t("ask.kicker")}</span>
          <strong>{t("ask.title")}</strong>
          <small>{t("ask.hint")}</small>
        </span>
        <button type="button" className="casa-ask-close" onClick={() => setOpen(false)} aria-label={t("ask.close")}>
          <IconClose />
        </button>
      </div>
      <label className="casa-ask-field">
        <span className="casa-ask-field-head">
          <span>{t("ask.message")}</span>
          <small>{note.length}/500</small>
        </span>
        <textarea
          ref={field}
          rows={3}
          maxLength={500}
          value={note}
          placeholder={suggestions[0]}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
      </label>
      <div className="casa-ask-quick">
        <span>{t("ask.quick")}</span>
        <div className="casa-ask-suggest">
          {suggestions.map((item) => (
            <button key={item} type="button" onClick={() => setNote(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="casa-ask-foot">
        <p><IconShield /> {t("ask.whatsapp")}</p>
        <button type="submit" className="casa-ask-send" disabled={!ready}>
          {t("ask.continue")}
          <IconWhatsApp />
        </button>
      </div>
    </form>
  );
}

function askSuggestions(tone: Tone, locale: CasaLocale) {
  return [casaText(locale, `ask.s1.${tone}` as CasaTextKey), casaText(locale, `ask.s2.${tone}` as CasaTextKey)];
}

function SensorDetail({ sensor, onClose }: { sensor: OwnerTile; onClose: () => void }) {
  const { locale, t } = useCasaLocale();
  return (
    <section className="casa-sensor-detail" aria-live="polite">
      <span className="casa-sensor-detail-icon" data-tone={sensor.tone}>{metricIcon(sensor.kind)}</span>
      <span className="casa-sensor-detail-copy">
        <small>{sensor.location}</small>
        <strong>{sensor.label}</strong>
        <em>{sensorStatus(sensor, locale)}</em>
      </span>
      <span className="casa-sensor-detail-value">{sensorDisplayValue(sensor, locale)}</span>
      <SensorBattery pct={sensor.batteryPct} />
      <button type="button" onClick={onClose} aria-label={t("close.sensor")}>×</button>
    </section>
  );
}

function SensorBattery({ pct }: { pct: number | null }) {
  const { t } = useCasaLocale();
  if (pct == null) {
    return (
      <span className="casa-battery is-unknown">
        <span className="casa-battery-cell" aria-hidden="true" />
        <span className="casa-battery-meta">
          <small>{t("battery.unknown")}</small>
        </span>
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const level = clamped < 20 ? "low" : clamped < 40 ? "mid" : "ok";
  const word = clamped < 20 ? t("battery.weak") : clamped < 40 ? t("battery.low") : clamped < 80 ? t("battery.good") : t("battery.full");

  return (
    <span className="casa-battery" data-level={level}>
      <span className="casa-battery-cell" aria-hidden="true">
        <i style={{ width: `${clamped}%` }} />
      </span>
      <span className="casa-battery-meta">
        <strong>{clamped}%</strong>
        <small>{word}</small>
      </span>
    </span>
  );
}

function HistoryPane({
  token,
  devices,
  now,
}: {
  token: string;
  devices: CasaOwnerDevice[];
  now: Date;
}) {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState<CasaHistorySample[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [done, setDone] = useState(false);
  const cursor = useRef<CasaHistoryCursor | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const { locale, t } = useCasaLocale();
  const byId = new Map(devices.map((device) => [device.id, device]));
  const days = groupHistoryDays(items, now, locale);

  useEffect(() => {
    const ac = new AbortController();
    const mine = ++generation.current;
    cursor.current = null;
    busy.current = true;
    setItems([]);
    setDone(false);
    setStatus("loading");

    void fetchHistoryPage(token, { deviceId: filter, signal: ac.signal })
      .then((page) => {
        if (generation.current !== mine) return;
        cursor.current = page.nextCursor;
        setItems(page.samples);
        setDone(!page.nextCursor);
        setStatus("ready");
        busy.current = false;
      })
      .catch((error: unknown) => {
        if (ac.signal.aborted || generation.current !== mine) return;
        setStatus("error");
        busy.current = false;
        console.error(error);
      });

    return () => {
      ac.abort();
      busy.current = false;
    };
  }, [token, filter]);

  const loadMore = useCallback(() => {
    if (busy.current || !cursor.current) return;
    const mine = generation.current;
    const next = cursor.current;
    busy.current = true;
    void fetchHistoryPage(token, { deviceId: filter, cursor: next })
      .then((page) => {
        if (generation.current !== mine) return;
        cursor.current = page.nextCursor;
        setItems((current) => mergeHistory(current, page.samples));
        setDone(!page.nextCursor);
        busy.current = false;
      })
      .catch(() => {
        if (generation.current !== mine) return;
        busy.current = false;
      });
  }, [token, filter]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || status !== "ready") return;
    const root = node.closest(".casa-screen");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root, rootMargin: "360px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loadMore, status, items.length]);

  return (
    <div className="casa-pane">
      <h2>{t("history.title")}</h2>
      <p className="casa-pane-lead">
        {status === "loading" && items.length === 0
          ? t("history.loading")
          : items.length
            ? t("history.lead")
            : t("history.emptySensors")}
      </p>
      {devices.length > 1 ? (
        <div className="casa-history-filters" role="tablist" aria-label={t("history.filter")}>
          <button type="button" className={filter === "all" ? "is-on" : undefined} onClick={() => setFilter("all")}>
            {t("history.all")}
          </button>
          {devices.map((device) => (
            <button
              key={device.id}
              type="button"
              className={filter === device.id ? "is-on" : undefined}
              onClick={() => setFilter(device.id)}
            >
              {device.label}
            </button>
          ))}
        </div>
      ) : null}
      {status === "error" && items.length === 0 ? (
        <p className="casa-history-empty">{t("history.error")}</p>
      ) : null}
      {status === "ready" && days.length === 0 ? (
        <p className="casa-history-empty">{t("history.empty")}</p>
      ) : null}
      {days.map((day) => (
        <section key={day.key} className="casa-history-day">
          <h3>{day.label}</h3>
          <ol className="casa-history-list">
            {day.rows.map((sample) => {
              const device = byId.get(sample.deviceId);
              return (
                <li key={sample.id} data-tone={historyTone(sample)}>
                  <time dateTime={sample.recordedAt}>{format(new Date(sample.recordedAt), "HH:mm", { locale: casaFnsLocale(locale) })}</time>
                  <div>
                    <strong>{device?.label ?? t("history.sensor")}</strong>
                    <small>{sampleSummary(sample, device, locale)}</small>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <div ref={sentinel} className="casa-history-more" aria-hidden="true">
        {status === "ready" && !done && items.length > 0 ? <i /> : null}
        {done && items.length > 0 ? <span>{t("history.end")}</span> : null}
      </div>
    </div>
  );
}

async function fetchHistoryPage(
  token: string,
  input: { deviceId: string; cursor?: CasaHistoryCursor | null; signal?: AbortSignal },
) {
  const params = new URLSearchParams();
  if (input.deviceId !== "all") params.set("deviceId", input.deviceId);
  if (input.cursor) {
    params.set("at", input.cursor.recordedAt);
    params.set("id", input.cursor.id);
  }
  const query = params.toString();
  const response = await fetch(`/api/casa/${token}/history${query ? `?${query}` : ""}`, {
    signal: input.signal,
  });
  if (!response.ok) throw new Error("history");
  return (await response.json()) as { samples: CasaHistorySample[]; nextCursor: CasaHistoryCursor | null };
}

function mergeHistory(current: CasaHistorySample[], incoming: CasaHistorySample[]) {
  if (incoming.length === 0) return current;
  const seen = new Set(current.map((item) => item.id));
  const extra = incoming.filter((item) => !seen.has(item.id));
  return extra.length ? current.concat(extra) : current;
}

function groupHistoryDays(samples: CasaHistorySample[], now: Date, locale: CasaLocale) {
  const groups: { key: string; label: string; rows: CasaHistorySample[] }[] = [];
  for (const sample of samples) {
    const at = new Date(sample.recordedAt);
    const key = format(startOfDay(at), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.rows.push(sample);
      continue;
    }
    groups.push({ key, label: casaHistoryDay(at, now, locale), rows: [sample] });
  }
  return groups;
}

function sampleSummary(sample: CasaHistorySample, device: CasaOwnerDevice | undefined, locale: CasaLocale) {
  const parts: string[] = [];
  if (sample.temperature != null) {
    parts.push(`${sample.temperature.toLocaleString(casaDateLocale(locale), { maximumFractionDigits: 1 })}°`);
  }
  if (sample.humidity != null) parts.push(`${Math.round(sample.humidity)}%`);
  if (device?.kind === "WATER") parts.push(casaText(locale, sample.leak ? "history.leak" : "history.dry"));
  if (device?.kind === "DOOR") parts.push(casaText(locale, sample.open ? "history.open" : "history.closed"));
  if (device?.kind === "MOTION") {
    parts.push(casaText(locale, sample.motion ? "history.motion" : "history.calm"));
    if (sample.lux != null) parts.push(`${Math.round(sample.lux)} lx`);
  }
  if (!sample.online) parts.push(casaText(locale, "history.offline"));
  if (sample.batteryPct != null && sample.batteryPct < 20) {
    parts.push(casaText(locale, "history.battery", { n: sample.batteryPct }));
  }
  return parts.join(" · ") || casaText(locale, "history.reading");
}

function historyTone(sample: CasaHistorySample) {
  if (sample.leak || !sample.online) return "alert";
  if (sample.open || sample.motion) return "warn";
  return "ok";
}

function AlertsPane({ alerts, token }: { alerts: CasaOwnerAlert[]; token: string }) {
  const { locale, t } = useCasaLocale();
  if (alerts.length === 0) {
    return (
      <div className="casa-pane">
        <h2>{t("alerts.emptyTitle")}</h2>
        <p className="casa-pane-lead">{t("alerts.emptyLead")}</p>
        <CasaPushEnable token={token} />
      </div>
    );
  }

  return (
    <div className="casa-pane">
      <h2>{t("alerts.title")}</h2>
      <ol className="casa-timeline">
        {alerts.map((item) => (
          <li key={item.id} className={item.status === "OPEN" ? "is-open" : "is-ok"}>
            <span>{item.status === "OPEN" ? t("alerts.open") : t("alerts.resolved")}</span>
            <strong>{casaAlertTypeLabel(locale, item.type)}</strong>
            <small>
              {item.message} · {casaRelativeTime(item.triggeredAt, locale)}
            </small>
          </li>
        ))}
      </ol>
      <CasaPushEnable token={token} />
    </div>
  );
}

function LaroPane({ tone, token }: { tone: Tone; token: string }) {
  const { t } = useCasaLocale();
  return (
    <div className="casa-contact">
      <span className="casa-logo" aria-hidden="true" />
      <h2>{tone === "alert" || tone === "warn" ? t("laro.alerted") : t("laro.near")}</h2>
      <p className="casa-place-line">Penela · Centro de Portugal</p>
      <p>
        {tone === "alert" || tone === "warn" ? t("laro.alertBody") : t("laro.okBody")}
      </p>
      <a className="casa-action" href={WHATSAPP} rel="noopener noreferrer" target="_blank">
        {t("laro.whatsapp")}
      </a>
      <a className="casa-tel" href="tel:+351931063911">
        +351 931 063 911
      </a>
      <CasaPushEnable token={token} />
    </div>
  );
}

function sensorDisplayValue(sensor: OwnerTile, locale: CasaLocale) {
  if (sensor.valueKey) return casaText(locale, sensor.valueKey);
  return sensor.value;
}

function sensorStatus(sensor: OwnerTile, locale: CasaLocale) {
  if (sensor.tone === "alert") return casaText(locale, "status.alert");
  if (sensor.tone === "offline") return casaText(locale, "status.offline");
  if (sensor.tone === "idle") return casaText(locale, "status.idle");
  if (batteryLow(sensor.batteryPct) && sensor.tone !== "warn") return casaText(locale, "status.lowBattery");
  if (sensor.tone === "warn") return casaText(locale, "status.attention");
  if (sensor.kind === "door") {
    return casaText(locale, sensor.valueKey === "chip.doorClosed" ? "status.houseSafe" : "status.doorOpen");
  }
  if (sensor.kind === "water") {
    return casaText(locale, sensor.valueKey === "chip.noLeak" ? "status.allDry" : "status.normal");
  }
  if (sensor.kind === "motion") {
    return casaText(locale, sensor.valueKey === "chip.motion" ? "status.presence" : "status.nobody");
  }
  return casaText(locale, "status.inRange");
}

function chipAriaLabel(chip: OwnerTile, locale: CasaLocale) {
  const battery = chip.batteryPct != null ? ` ${casaText(locale, "battery.aria", { n: Math.round(chip.batteryPct) })}` : "";
  return `${chip.label}: ${sensorDisplayValue(chip, locale)}. ${sensorStatus(chip, locale)}.${battery}`;
}

function batteryLow(pct: number | null) {
  return pct != null && pct < 20;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

function lisbonHour(now: Date) {
  return Number(
    new Intl.DateTimeFormat("pt-PT", {
      timeZone: "Europe/Lisbon",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
}

type DayPart = "morning" | "afternoon" | "evening" | "night";

function dayPart(hour: number): DayPart {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 20) return "afternoon";
  if (hour >= 20 && hour < 23) return "evening";
  return "night";
}

function dayWhen(part: DayPart, locale: CasaLocale) {
  if (part === "morning") return casaText(locale, "hello.morning");
  if (part === "afternoon") return casaText(locale, "hello.afternoon");
  return casaText(locale, "hello.evening");
}

function readingTone(device: CasaOwnerDevice): Tone {
  return pulseDeviceSeverity({ ...device, batteryPct: null });
}

function orbitChips(tiles: OwnerTile[]) {
  const slots: Record<string, "ne" | "w" | "se" | "nw" | "e"> = {
    temperature: "ne",
    humidity: "w",
    door: "se",
    water: "nw",
    motion: "e",
  };
  return tiles
    .filter((tile) => tile.kind in slots)
    .filter((tile) => tile.kind !== "water" || tile.tone === "alert" || tiles.length < 4)
    .map((tile) => ({ ...tile, slot: slots[tile.kind] }));
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.2 16.5h11.6c.7 0 1.1-.8.7-1.4-.6-1-1.5-2.4-1.5-4.3a5 5 0 1 0-10 0c0 1.9-.9 3.3-1.5 4.3-.4.6 0 1.4.7 1.4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M10 16.6a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 4.2 13.1 6c.3.1.7.2 1 .4l1.8-.7.9.9-.7 1.8c.2.3.3.7.4 1L19.8 12 18 13.1c-.1.3-.2.7-.4 1l.7 1.8-.9.9-1.8-.7c-.3.2-.7.3-1 .4L12 19.8 10.9 18c-.3-.1-.7-.2-1-.4l-1.8.7-.9-.9.7-1.8c-.2-.3-.3-.7-.4-1L4.2 12 6 10.9c.1-.3.2-.7.4-1L5.7 8.1l.9-.9 1.8.7c.3-.2.7-.3 1-.4L12 4.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function IconChevron() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" /></svg>;
}

function IconSend() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9.2 4.2 13 8l-3.8 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 11.6a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.6Z" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7.7c.2-.4.4-.4.7-.4h.4c.2 0 .3.1.4.4l.7 1.7c.1.3 0 .4-.1.6l-.5.6c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.7 2.6.2.1.4.1.6-.1l.7-.9c.2-.2.4-.3.6-.1l1.7.8c.3.1.4.3.4.5 0 .4-.2 1.3-.8 1.8-.5.5-1.3.8-2.2.6-1-.2-2.4-.7-4.1-2.2-1.4-1.3-2.4-2.8-2.7-3.8-.3-.9 0-2 .5-2.7Z" fill="currentColor" />
    </svg>
  );
}

function IconClose() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" /></svg>;
}

function IconShield() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.8 13 4v3.4c0 3.1-2 5.7-5 6.8-3-1.1-5-3.7-5-6.8V4l5-2.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter" /><path d="m5.9 8 1.3 1.3 2.9-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" strokeLinejoin="miter" /></svg>;
}

function IconHome() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M14 51V27l18-16 18 16v24M25 51V36h14v15"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7.2v5.1l3.2 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M5.2 12a6.8 6.8 0 1 0 1.6-4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
      <path d="M5 6.6v3.3h3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function IconMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="12" rx="7.2" ry="6.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconDrop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.5s6 6.2 6 10.2a6 6 0 1 1-12 0C6 10.7 12 4.5 12 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
    </svg>
  );
}

function IconTemp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 14.2V6.5a2 2 0 1 1 4 0v7.7a3.2 3.2 0 1 1-4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M12 16.2v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

function IconHumidity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.8s6 6.4 6 10.4a6 6 0 1 1-12 0c0-4 6-10.4 6-10.4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M9.2 15.1c.7 1.3 1.6 1.8 2.8 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function IconDoor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 20.5V5.2A1.2 1.2 0 0 1 8.2 4h7.6A1.2 1.2 0 0 1 17 5.2V20.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M14.6 12.2h.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function IconMotion() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
      <path d="m6.6 6.6 1.6 1.6M15.8 15.8l1.6 1.6M17.4 6.6l-1.6 1.6M8.2 15.8l-1.6 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function metricIcon(kind: OwnerTile["kind"]) {
  if (kind === "water") return <IconDrop />;
  if (kind === "temperature") return <IconTemp />;
  if (kind === "humidity") return <IconHumidity />;
  if (kind === "door") return <IconDoor />;
  if (kind === "motion") return <IconMotion />;
  return <IconMark />;
}

function houseTone(devices: CasaOwnerDevice[], openAlertCount: number, sensors: CasaOwnerDevice[]): Tone {
  const kind = casaHeadlineKind(devices, openAlertCount);
  if (sensors.some((device) => pulseDeviceSeverity(device) === "alert") || kind.id === "leak") return "alert";
  if (kind.id === "alerts" || kind.id === "motion") return "warn";
  if (kind.id === "offline" || sensors.some((device) => pulseDeviceSeverity(device) === "offline")) return "offline";
  if (!sensors.length || sensors.every((device) => !device.lastSeenAt)) return "idle";
  return "ok";
}

type OwnerTile = {
  id: string;
  kind: "water" | "temperature" | "humidity" | "door" | "motion" | "other";
  label: string;
  location: string;
  value: string;
  valueKey?: CasaTextKey;
  tone: Tone;
  batteryPct: number | null;
};

function ownerTiles(devices: CasaOwnerDevice[], locale: CasaLocale): OwnerTile[] {
  const numbers = casaDateLocale(locale);
  return devices.flatMap<OwnerTile>((device): OwnerTile[] => {
    const reading = device.reading;
    const tone = readingTone(device);
    const batteryPct = device.batteryPct;

    if (device.kind === "TEMP_HUMIDITY") {
      const temperature = reading.temperature ?? 0;
      const humidity = reading.humidity ?? 0;
      return [
        {
          id: `${device.id}-temp`,
          kind: "temperature" as const,
          label: casaText(locale, "chip.temp"),
          location: device.label || casaText(locale, "chip.room"),
          value: reading.temperature != null ? `${reading.temperature.toLocaleString(numbers, { maximumFractionDigits: 1 })}°` : "—",
          tone: temperature && (temperature < 10 || temperature > 32) ? "warn" : tone,
          batteryPct,
        },
        {
          id: `${device.id}-hum`,
          kind: "humidity" as const,
          label: casaText(locale, "chip.humidity"),
          location: device.label || casaText(locale, "chip.room"),
          value: reading.humidity != null ? `${humidity.toLocaleString(numbers, { maximumFractionDigits: 0 })}%` : "—",
          tone: humidity > 75 ? "warn" : tone,
          batteryPct,
        },
      ];
    }

    if (device.kind === "WATER") {
      const leak = reading.leak === true;
      const valueKey: CasaTextKey | undefined = leak ? "chip.leak" : reading.leak === false ? "chip.noLeak" : undefined;
      return [
        {
          id: device.id,
          kind: "water" as const,
          label: casaText(locale, "chip.water"),
          location: device.label || casaText(locale, "chip.kitchen"),
          value: leak ? casaText(locale, "chip.leak") : reading.leak === false ? casaText(locale, "chip.dry") : "—",
          valueKey,
          tone,
          batteryPct,
        },
      ];
    }

    if (device.kind === "DOOR") {
      const open = reading.open === true;
      const valueKey: CasaTextKey | undefined = open ? "chip.doorOpen" : reading.open === false ? "chip.doorClosed" : undefined;
      return [
        {
          id: device.id,
          kind: "door" as const,
          label: casaText(locale, "chip.door"),
          location: device.label || casaText(locale, "chip.mainDoor"),
          value: open ? casaText(locale, "chip.open") : reading.open === false ? casaText(locale, "chip.closed") : "—",
          valueKey,
          tone,
          batteryPct,
        },
      ];
    }

    if (device.kind === "MOTION") {
      const moving = reading.motion === true;
      const lux = reading.lux != null ? `${Math.round(reading.lux)} lx` : null;
      const valueKey: CasaTextKey | undefined = moving ? "chip.motion" : reading.motion === false ? "chip.noMotion" : undefined;
      return [
        {
          id: device.id,
          kind: "motion" as const,
          label: casaText(locale, "chip.presence"),
          location: device.label || casaText(locale, "chip.room"),
          value: moving
            ? casaText(locale, "chip.motion")
            : lux ?? (reading.motion === false ? casaText(locale, "chip.still") : "—"),
          valueKey: moving ? "chip.motion" : valueKey,
          tone,
          batteryPct,
        },
      ];
    }

    return [
      {
        id: device.id,
        kind: "other" as const,
        label: device.label,
        location: device.label,
        value: device.online ? casaText(locale, "chip.online") : "—",
        valueKey: device.online ? "chip.online" : undefined,
        tone,
        batteryPct,
      },
    ];
  });
}
