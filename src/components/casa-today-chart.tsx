"use client";

import { useMemo, useState } from "react";
import type { PulseAlertType, PulseSample } from "@prisma/client";
import type { CasaOwnerAlert, CasaOwnerDevice } from "@/lib/casa";
import { buildCasaDay, type CasaDay, type CasaDayMark, type CasaDayReadout } from "@/lib/casa-day";
import { casaBeadLead, casaDayFraction, casaRibbonBeads, type CasaRibbonBead } from "@/lib/casa-ribbon";
import { casaAlertMarkLabel, casaDateLocale, type CasaLocale, type CasaTextKey } from "@/lib/casa-locale";
import { useCasaLocale } from "@/components/use-casa-locale";

type Translate = (key: CasaTextKey, vars?: Record<string, string | number>) => string;

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
  const beads = useMemo(() => casaRibbonBeads(day.marks, day.from), [day]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = beads.find((bead) => bead.id === selectedId) ?? null;

  const caption = selected
    ? casaBeadLead(selected).label
    : day.marks.length === 0
      ? t("today.quiet")
      : day.marks.length === 1
        ? t("today.one")
        : t("today.many", { n: day.marks.length });

  return (
    <section className="casa-today">
      <header className="casa-today-head">
        <div className="casa-today-title">
          <h2>{t("today.title")}</h2>
          <p>{caption}</p>
        </div>
        {selected ? <BeadReadout bead={selected} locale={locale} t={t} /> : null}
      </header>
      <DayRibbon
        day={day}
        beads={beads}
        selectedId={selectedId}
        locale={locale}
        t={t}
        onChoose={(id) => setSelectedId((current) => (current === id ? null : id))}
      />
    </section>
  );
}

function DayRibbon({
  day,
  beads,
  selectedId,
  locale,
  t,
  onChoose,
}: {
  day: CasaDay;
  beads: CasaRibbonBead[];
  selectedId: string | null;
  locale: CasaLocale;
  t: Translate;
  onChoose: (id: string) => void;
}) {
  const elapsed = casaDayFraction(day.to, day.from);

  return (
    <div className="casa-ribbon">
      <div className="casa-ribbon-track">
        <i className="casa-ribbon-thread" aria-hidden="true" />
        <i className="casa-ribbon-past" style={{ width: pct(elapsed) }} aria-hidden="true" />
        <ol className="casa-ribbon-beads">
          {beads.map((bead) => {
            const lead = casaBeadLead(bead);
            return (
              <li key={bead.id} style={{ left: pct(bead.start), width: pct(bead.span) }}>
                <button
                  type="button"
                  className="casa-ribbon-bead"
                  data-tone={bead.tone}
                  data-open={bead.open ? "true" : undefined}
                  data-many={bead.marks.length > 1 ? "true" : undefined}
                  data-active={selectedId === bead.id ? "true" : undefined}
                  aria-pressed={selectedId === bead.id}
                  aria-label={beadAria(bead, lead, locale, t)}
                  onClick={() => onChoose(bead.id)}
                />
              </li>
            );
          })}
        </ol>
        <i className="casa-ribbon-now" style={{ left: pct(elapsed) }} aria-hidden="true" />
      </div>
      <ol className="casa-ribbon-axis">
        {day.ticks.map((tick) => {
          const at = casaDayFraction(tick.at, day.from);
          return (
            <li
              key={`${tick.at}-${tick.label}`}
              data-now={tick.now ? "true" : undefined}
              data-edge={at < 0.08 ? "start" : at > 0.92 ? "end" : undefined}
              style={{ left: pct(at) }}
            >
              {tick.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BeadReadout({ bead, locale, t }: { bead: CasaRibbonBead; locale: CasaLocale; t: Translate }) {
  const lead = casaBeadLead(bead);
  const many = bead.marks.length > 1;
  const readout = many ? undefined : lead.readout;

  return (
    <p className="casa-today-read" data-tone={bead.tone}>
      <span className="casa-today-mark">{markGlyph(lead.alertType)}</span>
      <span className="casa-today-figures">
        {many ? (
          <span className="casa-today-value">
            <b>{bead.marks.length}</b>
          </span>
        ) : readout ? (
          <span className="casa-today-value">
            <b>{formatReadoutValue(readout, locale)}</b>
            <i>{readout.kind === "temperature" ? "°C" : "%"}</i>
          </span>
        ) : (
          <strong className="casa-today-status">{lead.detail}</strong>
        )}
        <small>
          <em>{many ? t("today.events") : casaAlertMarkLabel(locale, lead.alertType)}</em>
          <span>{many ? beadRange(bead) : formatClock(lead.at)}</span>
        </small>
      </span>
    </p>
  );
}

function beadRange(bead: CasaRibbonBead) {
  const first = formatClock(bead.marks[0].at);
  const last = formatClock(bead.marks[bead.marks.length - 1].at);
  return first === last ? first : `${first}–${last}`;
}

function beadAria(bead: CasaRibbonBead, lead: CasaDayMark, locale: CasaLocale, t: Translate) {
  if (bead.marks.length > 1) {
    return `${t("today.many", { n: bead.marks.length })}, ${beadRange(bead)}`;
  }
  return `${formatClock(lead.at)} ${lead.label}, ${lead.detail}`;
}

function pct(value: number) {
  return `${(value * 100).toFixed(3)}%`;
}

function formatReadoutValue(readout: CasaDayReadout, locale: CasaLocale) {
  if (readout.kind === "temperature") {
    return readout.value.toLocaleString(casaDateLocale(locale), { maximumFractionDigits: 1 });
  }
  return String(Math.round(readout.value));
}

function markGlyph(type: PulseAlertType) {
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

function formatClock(at: number) {
  const date = new Date(at);
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(date);
  const minute = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", minute: "2-digit" }).format(date);
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
