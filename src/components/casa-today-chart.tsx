"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { PulseAlertType, PulseSample } from "@prisma/client";
import type { CasaOwnerAlert, CasaOwnerDevice } from "@/lib/casa";
import {
  buildCasaDay,
  casaChartChipPlacement,
  CASA_CHART_WINDOW_MS,
  smoothPath,
  type CasaDay,
  type CasaDayMark,
  type CasaDayReadout,
} from "@/lib/casa-day";
import { casaAlertMarkLabel, casaDateLocale, type CasaLocale } from "@/lib/casa-locale";
import { useCasaLocale } from "@/components/use-casa-locale";

const HEIGHT = 96;
const TOP = 14;
const BOTTOM = 88;
const HOUR = 3_600_000;

export function CasaTodayChart({
  devices,
  alerts,
  samples = [],
  now,
}: {
  devices: CasaOwnerDevice[];
  alerts: CasaOwnerAlert[];
  samples?: PulseSample[];
  now: Date;
}) {
  const { locale, t } = useCasaLocale();
  const day = useMemo(
    () => buildCasaDay({ devices, alerts, samples, now, locale }),
    [devices, alerts, samples, now, locale],
  );
  const events = day.marks.filter((mark) => mark.kind === "event");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tape = useTape(day);
  const visibleEvents = events.filter((mark) => mark.at >= tape.start && mark.at <= tape.start + tape.windowMs);
  const selected = events.find((mark) => mark.id === selectedId) ?? null;
  const hasClimate = day.points.length > 0 || day.humidity != null;
  const caption = selected
    ? selected.readout
      ? `${formatClock(selected.at)} ${selected.label}`
      : selected.label
    : visibleEvents.length
      ? visibleEvents.length === 1
        ? t("today.one")
        : t("today.many", { n: visibleEvents.length })
      : !hasClimate
        ? t("today.noClimate")
        : tape.pinned
          ? t("today.calm")
          : t("today.earlier");

  return (
    <section className="casa-today">
      <header className="casa-today-head">
        <div className="casa-today-title">
          <h2>{t("today.title")}</h2>
          <p>{caption}</p>
        </div>
        {selected ? <SelectedReadout mark={selected} /> : null}
      </header>
      <DayPlot
        day={day}
        events={events}
        selected={selected}
        tape={tape}
        hasClimate={hasClimate}
        onChoose={(id) => setSelectedId((current) => (current === id ? null : id))}
        onClear={() => setSelectedId(null)}
      />
    </section>
  );
}

function SelectedReadout({ mark }: { mark: CasaDayMark }) {
  const { locale, t } = useCasaLocale();
  const readout = mark.readout;
  return (
    <p className="casa-today-read" data-tone={mark.tone}>
      {readout ? (
        <span className="casa-today-value">
          <b>{formatReadoutValue(readout, locale)}</b>
          <i>{readout.kind === "temperature" ? "°C" : "%"}</i>
        </span>
      ) : (
        <strong className="casa-today-status">{mark.detail}</strong>
      )}
      <small>
        {readout ? <em>{mark.detail}</em> : null}
        <span>{readout ? t(readoutLabelKey(readout.kind)) : formatClock(mark.at)}</span>
      </small>
    </p>
  );
}

function readoutLabelKey(kind: CasaDayReadout["kind"]) {
  switch (kind) {
    case "temperature":
      return "today.temperature";
    case "battery":
      return "today.battery";
    case "humidity":
      return "today.humidity";
  }
}

function formatReadoutValue(readout: CasaDayReadout, locale: CasaLocale) {
  if (readout.kind === "temperature") {
    return readout.value.toLocaleString(casaDateLocale(locale), { maximumFractionDigits: 1 });
  }
  return String(Math.round(readout.value));
}

function DayPlot({
  day,
  events,
  selected,
  tape,
  hasClimate,
  onChoose,
  onClear,
}: {
  day: CasaDay;
  events: CasaDayMark[];
  selected: CasaDayMark | null;
  tape: Tape;
  hasClimate: boolean;
  onChoose: (id: string) => void;
  onClear: () => void;
}) {
  const { locale, t } = useCasaLocale();
  const gradientId = useId().replace(/:/g, "");
  const coords = expandPlotCoords(
    day.points.map((point) => toXy(point.at, point.humidity, day, tape.units)),
    tape.units,
  );
  const line = smoothPath(coords);
  const last = coords[coords.length - 1];
  const area = line && last && coords.length > 1
    ? `${line} L${last.x.toFixed(2)} ${BOTTOM} L${coords[0].x.toFixed(2)} ${BOTTOM} Z`
    : "";
  const now = day.humidity != null ? toXy(day.nowAt, day.humidity, day, tape.units) : null;
  const band = hasClimate ? comfortBand(day, tape.units) : null;
  const empty = !hasClimate && events.length === 0;

  return (
    <div className="casa-day">
      <div
        ref={tape.port}
        className={`casa-day-port${tape.dragging ? " is-drag" : ""}`}
        onPointerDown={tape.onPointerDown}
        onPointerMove={tape.onPointerMove}
        onPointerUp={tape.onPointerUp}
        onPointerCancel={tape.onPointerUp}
        onKeyDown={tape.onKeyDown}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(tape.progress * 100)}
        aria-label={t("today.scrub")}
      >
        <div className="casa-day-tape" style={tape.style}>
          <div className="casa-day-plot-wrap" onClick={tape.dragged ? undefined : onClear}>
            <svg
              className="casa-day-plot"
              viewBox={`0 0 ${tape.units} ${HEIGHT}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`casa-day-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#294337" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#294337" stopOpacity="0" />
                </linearGradient>
              </defs>
              {band ? <rect className="casa-day-band" x="0" y={band.y} width={tape.units} height={band.height} /> : null}
              {hasClimate ? null : (
                <line className="casa-day-rail" x1="0" y1={(TOP + BOTTOM) / 2} x2={tape.units} y2={(TOP + BOTTOM) / 2} />
              )}
              {events.map((mark) => {
                const point = toXy(mark.at, mark.humidity, day, tape.units);
                return (
                  <g
                    key={`stem-${mark.id}`}
                    className="casa-day-stem"
                    data-tone={mark.tone}
                    data-kind={mark.alertType}
                    data-active={selected?.id === mark.id ? "true" : undefined}
                  >
                    <line x1={point.x} y1={BOTTOM} x2={point.x} y2={Math.min(BOTTOM - 2, point.y + 14)} />
                  </g>
                );
              })}
              {area ? <path className="casa-day-fill" d={area} fill={`url(#casa-day-fill-${gradientId})`} /> : null}
              {line ? <path className="casa-day-line-back" d={line} /> : null}
              {line ? <path className="casa-day-line" d={line} /> : null}
            </svg>
            {empty ? <p className="casa-day-empty">{t("today.noClimate")}</p> : null}
            {events.map((mark) => {
              const point = toXy(mark.at, mark.humidity, day, tape.units);
              const active = selected?.id === mark.id;
              const chip = active ? casaChartChipPlacement(mark.at, tape.start, tape.windowMs) : null;
              return (
                <button
                  key={mark.id}
                  type="button"
                  className="casa-day-event"
                  data-tone={mark.tone}
                  data-kind={mark.alertType}
                  data-active={active ? "true" : undefined}
                  data-side={chip?.side}
                  data-flush={chip?.flush ?? undefined}
                  style={dotStyle(point, tape.units)}
                  aria-pressed={active}
                  aria-label={`${formatClock(mark.at)} ${mark.label}, ${mark.detail}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChoose(mark.id);
                  }}
                >
                  <span className="casa-day-event-face">{markGlyph(mark.alertType)}</span>
                  {active && mark.alertType ? (
                    <span className="casa-day-flag" data-tone={mark.tone}>
                      <b>{formatClock(mark.at)}</b>
                      <i>{casaAlertMarkLabel(locale, mark.alertType)}</i>
                    </span>
                  ) : null}
                </button>
              );
            })}
            {now ? <i className="casa-day-now" style={dotStyle(now, tape.units)} /> : null}
          </div>
          <ol className="casa-day-axis">
            {day.ticks.map((tick, index) => (
              <li
                key={`${tick.at}-${tick.label}`}
                data-now={tick.now ? "true" : undefined}
                data-edge={index === 0 ? "start" : tick.now ? "end" : undefined}
                style={{ left: `${xPercent(tick.at, day)}%` }}
              >
                {tick.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

type Tape = {
  port: RefObject<HTMLDivElement | null>;
  style: { width: string; transform: string };
  units: number;
  windowMs: number;
  start: number;
  pinned: boolean;
  dragging: boolean;
  dragged: boolean;
  progress: number;
  jumpToNow: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

function useTape(day: CasaDay): Tape {
  const port = useRef<HTMLDivElement>(null);
  const viewStart = useRef(latestStart(day));
  const pinned = useRef(true);
  const dragging = useRef(false);
  const dragged = useRef(false);
  const pointer = useRef({ id: 0, x: 0, origin: 0, lastX: 0, lastT: 0, velocity: 0 });
  const motion = useRef(0);
  const [, render] = useState(0);
  const refresh = () => render((value) => value + 1);

  const windowMs = Math.min(CASA_CHART_WINDOW_MS, Math.max(60_000, day.to - day.from));
  const dayMs = Math.max(windowMs, day.to - day.from);
  const units = (dayMs / windowMs) * 480;
  const minStart = day.from;
  const maxStart = Math.max(minStart, day.to - windowMs);

  useEffect(() => {
    if (pinned.current) {
      viewStart.current = latestStart(day);
      refresh();
    }
  }, [day.to, day.from]);

  useEffect(() => () => window.cancelAnimationFrame(motion.current), []);

  useEffect(() => {
    const node = port.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
      if (!delta) return;
      event.preventDefault();
      stopMotion();
      apply(viewStart.current + delta * msPerPx(), false);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  });

  function bounds() {
    return { min: minStart, max: maxStart, windowMs, dayMs };
  }

  function apply(next: number, pin?: boolean) {
    const { min, max } = bounds();
    viewStart.current = Math.min(max, Math.max(min, next));
    if (pin != null) pinned.current = pin;
    else pinned.current = max - viewStart.current < 45_000;
    refresh();
  }

  function msPerPx() {
    const width = port.current?.clientWidth ?? 1;
    return windowMs / width;
  }

  function jumpToNow() {
    stopMotion();
    animateTo(maxStart, true);
  }

  function stopMotion() {
    window.cancelAnimationFrame(motion.current);
    motion.current = 0;
  }

  function animateTo(target: number, pin: boolean) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      apply(target, pin);
      return;
    }
    stopMotion();
    const from = viewStart.current;
    const started = performance.now();
    const duration = 720;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 4;
      apply(from + (target - from) * eased, pin);
      if (t < 1) motion.current = window.requestAnimationFrame(tick);
    };
    motion.current = window.requestAnimationFrame(tick);
  }

  function fling() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || Math.abs(pointer.current.velocity) < 0.04) {
      if (maxStart - viewStart.current < 8 * 60_000) animateTo(maxStart, true);
      return;
    }
    stopMotion();
    let velocity = pointer.current.velocity;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      velocity *= 0.94;
      apply(viewStart.current + velocity * dt);
      if (viewStart.current <= minStart || viewStart.current >= maxStart) {
        velocity = 0;
      }
      if (Math.abs(velocity) < 0.03) {
        if (maxStart - viewStart.current < 8 * 60_000) animateTo(maxStart, true);
        return;
      }
      motion.current = window.requestAnimationFrame(tick);
    };
    motion.current = window.requestAnimationFrame(tick);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as Element | null)?.closest?.(".casa-day-event")) return;
    stopMotion();
    dragging.current = true;
    dragged.current = false;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      origin: viewStart.current,
      lastX: event.clientX,
      lastT: performance.now(),
      velocity: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    refresh();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || event.pointerId !== pointer.current.id) return;
    const dx = event.clientX - pointer.current.x;
    if (Math.abs(dx) > 6) dragged.current = true;
    const now = performance.now();
    const dt = Math.max(8, now - pointer.current.lastT);
    const delta = -(event.clientX - pointer.current.lastX) * msPerPx();
    pointer.current.velocity = delta / dt;
    pointer.current.lastX = event.clientX;
    pointer.current.lastT = now;
    apply(pointer.current.origin - dx * msPerPx(), false);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pointer.current.id) return;
    dragging.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    if (dragged.current) fling();
    refresh();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      apply(viewStart.current - HOUR / 2, false);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      apply(viewStart.current + HOUR / 2);
    }
    if (event.key === "Home") {
      event.preventDefault();
      animateTo(minStart, false);
    }
    if (event.key === "End") {
      event.preventDefault();
      jumpToNow();
    }
  }

  const offsetPct = dayMs <= 0 ? 0 : ((viewStart.current - day.from) / dayMs) * 100;

  return {
    port,
    style: {
      width: `${(dayMs / windowMs) * 100}%`,
      transform: `translate3d(-${offsetPct}%, 0, 0)`,
    },
    units,
    windowMs,
    start: viewStart.current,
    pinned: pinned.current,
    dragging: dragging.current,
    dragged: dragged.current,
    progress: maxStart === minStart ? 1 : (viewStart.current - minStart) / (maxStart - minStart),
    jumpToNow,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
  };
}

function latestStart(day: CasaDay) {
  const windowMs = Math.min(CASA_CHART_WINDOW_MS, Math.max(60_000, day.to - day.from));
  return Math.max(day.from, day.to - windowMs);
}

function toXy(at: number, humidity: number, day: CasaDay, units: number) {
  const span = day.domain.max - day.domain.min || 1;
  return {
    x: round2((xPercent(at, day) / 100) * units),
    y: round2(BOTTOM - ((humidity - day.domain.min) / span) * (BOTTOM - TOP)),
  };
}

function xPercent(at: number, day: CasaDay) {
  const span = day.to - day.from || 1;
  return Math.min(100, Math.max(0, ((at - day.from) / span) * 100));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function dotStyle(point: { x: number; y: number }, units: number) {
  return {
    left: `${(point.x / units) * 100}%`,
    top: `${(point.y / HEIGHT) * 100}%`,
  };
}

function comfortBand(day: CasaDay, units: number) {
  const low = Math.max(40, day.domain.min);
  const high = Math.min(60, day.domain.max);
  if (high <= low) return null;
  const top = toXy(day.from, high, day, units).y;
  const bottom = toXy(day.from, low, day, units).y;
  return { y: top, height: Math.max(0, bottom - top) };
}

function expandPlotCoords(coords: { x: number; y: number }[], units: number) {
  if (coords.length !== 1) return coords;
  const point = coords[0];
  const pad = Math.max(22, units * 0.04);
  return [
    { x: Math.max(0, point.x - pad), y: point.y },
    point,
    { x: Math.min(units, point.x + pad), y: point.y },
  ];
}

function markGlyph(type: PulseAlertType | undefined) {
  switch (type) {
    case "WATER_LEAK":
      return <IconDrop />;
    case "HUMIDITY_HIGH":
      return <IconHumidity />;
    case "MOTION":
      return <IconMotion />;
    case "TEMP_HIGH":
    case "TEMP_LOW":
      return <IconTemp />;
    case "BATTERY":
      return <IconBattery />;
    case "DOOR_OPEN":
      return <IconDoor />;
    case "OFFLINE":
      return <IconOffline />;
    default:
      return <IconMark />;
  }
}

function IconDrop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.5s6 6.2 6 10.2a6 6 0 1 1-12 0C6 10.7 12 4.5 12 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
    </svg>
  );
}

function IconHumidity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.8s6 6.4 6 10.4a6 6 0 1 1-12 0c0-4 6-10.4 6-10.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
      <path d="M9.2 15.1c.7 1.3 1.6 1.8 2.8 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
    </svg>
  );
}

function IconMotion() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7.1" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 19.6v-2.2c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
    </svg>
  );
}

function IconTemp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 14.2V6.5a2 2 0 1 1 4 0v7.7a3.2 3.2 0 1 1-4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
      <path d="M12 16.2v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function IconBattery() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.5 8.5h11v7h-11v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
      <path d="M16.5 11h2v2h-2M8 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function IconDoor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 20.5V5.2A1.2 1.2 0 0 1 8.2 4h7.6A1.2 1.2 0 0 1 17 5.2V20.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
      <path d="M14.6 12.2h.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="square" />
    </svg>
  );
}

function IconOffline() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.2 7.2 16.8 16.8M8.4 15.6a5.2 5.2 0 0 1 7.2 0M6 12a8.4 8.4 0 0 1 4.1-2.3M18 12a8.4 8.4 0 0 0-2.2-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      <path d="M12 18.4h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
    </svg>
  );
}

function IconMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function formatClock(at: number) {
  const date = new Date(at);
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(date);
  const minute = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", minute: "2-digit" }).format(date);
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
