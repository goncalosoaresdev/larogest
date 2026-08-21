import type { PulseAlert, PulseAlertType, PulseSample } from "@prisma/client";
import type { CasaOwnerAlert, CasaOwnerDevice } from "@/lib/casa";
import { casaAlertTone } from "@/lib/casa-alert-view";
import { casaAlertTypeLabel, casaText, type CasaLocale } from "@/lib/casa-locale";

const LISBON = "Europe/Lisbon";

export type CasaDayPoint = {
  at: number;
  humidity: number;
};

export type CasaDayReadoutKind = "humidity" | "temperature" | "battery";

export type CasaDayReadout = {
  kind: CasaDayReadoutKind;
  value: number;
};

/**
 * One thing that happened today. There is deliberately no vertical value here: the day
 * is read along time only, and severity comes from the alert type, not from a reading.
 */
export type CasaDayMark = {
  id: string;
  at: number;
  label: string;
  detail: string;
  tone: "warn" | "alert";
  open: boolean;
  alertType: PulseAlertType;
  readout?: CasaDayReadout;
};

type CasaDayAlert = Pick<PulseAlert, "id" | "type" | "status" | "triggeredAt"> & {
  deviceId?: string | null;
};

export type CasaDayTick = {
  at: number;
  label: string;
  now?: boolean;
};

export type CasaDay = {
  marks: CasaDayMark[];
  ticks: CasaDayTick[];
  /** Lisbon midnight. The ribbon scale runs a fixed 24 hours from here. */
  from: number;
  to: number;
};

export function startOfLisbonDay(now = new Date()) {
  const parts = lisbonParts(now);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) - lisbonOffsetMs(now));
}

export function buildCasaDay(input: {
  devices: CasaOwnerDevice[];
  alerts: Array<CasaDayAlert | CasaOwnerAlert>;
  samples?: PulseSample[];
  now?: Date;
  locale?: CasaLocale;
}): CasaDay {
  const now = input.now ?? new Date();
  const from = startOfLisbonDay(now).getTime();
  const to = now.getTime();
  const climate = input.devices.find((device) => device.kind === "TEMP_HUMIDITY");
  const humidity = humidityFromDevice(climate);
  const samples = input.samples ?? [];

  const marks = dayMarks({
    alerts: input.alerts,
    devices: input.devices,
    climate,
    samples,
    from,
    to,
    humidity,
    points: sampleHumiditySeries(samples, climate?.id, from, to, humidity),
    locale: input.locale ?? "pt",
  });

  return {
    marks,
    ticks: dayTicks(marks, to),
    from,
    to,
  };
}

export function seriesValueAt(points: { at: number; value: number }[], at: number) {
  if (points.length === 0) return null;
  if (at <= points[0].at) return points[0].value;
  const last = points[points.length - 1];
  if (at >= last.at) return last.value;
  const nextIndex = points.findIndex((point) => point.at >= at);
  const right = points[nextIndex];
  const left = points[nextIndex - 1];
  if (!left || !right) return last.value;
  const span = right.at - left.at || 1;
  return left.value + ((right.value - left.value) * (at - left.at)) / span;
}

export function humidityAt(points: CasaDayPoint[], at: number) {
  return seriesValueAt(
    points.map((point) => ({ at: point.at, value: point.humidity })),
    at,
  );
}

export function casaAlertReadout(
  type: PulseAlertType,
  values: { humidity: number | null; temperature: number | null; batteryPct: number | null },
): CasaDayReadout | undefined {
  switch (type) {
    case "HUMIDITY_HIGH":
      return values.humidity != null ? { kind: "humidity", value: values.humidity } : undefined;
    case "TEMP_HIGH":
    case "TEMP_LOW":
      return values.temperature != null ? { kind: "temperature", value: values.temperature } : undefined;
    case "BATTERY":
      return values.batteryPct != null ? { kind: "battery", value: values.batteryPct } : undefined;
    case "WATER_LEAK":
    case "DOOR_OPEN":
    case "MOTION":
    case "OFFLINE":
      return undefined;
  }
}

function sampleHumiditySeries(
  samples: PulseSample[],
  climateId: string | undefined,
  from: number,
  to: number,
  humidityNow: number | null,
): CasaDayPoint[] {
  return numericSeries(samples, climateId, from, to, (sample) => sample.humidity, humidityNow).map((point) => ({
    at: point.at,
    humidity: point.value,
  }));
}

function numericSeries(
  samples: PulseSample[],
  deviceId: string | undefined,
  from: number,
  to: number,
  read: (sample: PulseSample) => number | null | undefined,
  nowValue: number | null,
): { at: number; value: number }[] {
  const points = samples
    .filter((sample) => sample.deviceId === deviceId)
    .map((sample) => {
      const value = read(sample);
      if (value == null) return null;
      return { at: new Date(sample.recordedAt).getTime(), value };
    })
    .filter((point): point is { at: number; value: number } => point != null && point.at >= from && point.at <= to)
    .sort((left, right) => left.at - right.at);

  if (nowValue != null) {
    const last = points[points.length - 1];
    if (!last || to - last.at > 15_000 || Math.abs(last.value - nowValue) >= 0.2) {
      points.push({ at: to, value: nowValue });
    } else {
      last.at = to;
      last.value = nowValue;
    }
  }

  return points;
}

function dayMarks(input: {
  alerts: Array<CasaDayAlert | CasaOwnerAlert>;
  devices: CasaOwnerDevice[];
  climate?: CasaOwnerDevice;
  samples: PulseSample[];
  from: number;
  to: number;
  humidity: number | null;
  points: CasaDayPoint[];
  locale: CasaLocale;
}): CasaDayMark[] {
  const marks: CasaDayMark[] = [];
  const temperatureNow = typeof input.climate?.reading.temperature === "number" ? input.climate.reading.temperature : null;
  const temperaturePoints = numericSeries(
    input.samples,
    input.climate?.id,
    input.from,
    input.to,
    (sample) => sample.temperature,
    temperatureNow,
  );
  const batteryByDevice = new Map<string, { at: number; value: number }[]>();

  const batteryPoints = (deviceId: string) => {
    const cached = batteryByDevice.get(deviceId);
    if (cached) return cached;
    const device = input.devices.find((item) => item.id === deviceId);
    const points = numericSeries(
      input.samples,
      deviceId,
      input.from,
      input.to,
      (sample) => sample.batteryPct,
      device?.batteryPct ?? null,
    );
    batteryByDevice.set(deviceId, points);
    return points;
  };

  for (const alert of input.alerts) {
    const at = new Date(alert.triggeredAt).getTime();
    if (at < input.from || at > input.to) continue;
    const humidity = humidityAt(input.points, at) ?? input.humidity;
    const temperature = seriesValueAt(temperaturePoints, at) ?? temperatureNow;
    const batteryPct = alert.deviceId ? seriesValueAt(batteryPoints(alert.deviceId), at) : null;
    const resolved = alert.status === "RESOLVED" || alert.status === "ACKED";
    marks.push({
      id: alert.id,
      at,
      label: casaAlertTypeLabel(input.locale, alert.type),
      detail: resolved ? casaText(input.locale, "chart.resolved") : casaText(input.locale, "chart.open"),
      tone: casaAlertTone(alert.type),
      open: !resolved,
      alertType: alert.type,
      readout: casaAlertReadout(alert.type, { humidity, temperature, batteryPct }),
    });
  }

  return marks.sort((left, right) => left.at - right.at);
}

/**
 * Axis labels are the events themselves, plus now. A clock time that would sit
 * on top of another — two alerts a few minutes apart, or an alert next to the
 * playhead — is dropped so the line stays readable.
 */
export function dayTicks(marks: Pick<CasaDayMark, "at">[], to: number): CasaDayTick[] {
  const near = 150 * 60_000;
  const ticks: CasaDayTick[] = [];
  const ordered = [...marks].sort((left, right) => left.at - right.at);
  for (const mark of ordered) {
    const last = ticks[ticks.length - 1];
    if (last && mark.at - last.at < near) continue;
    if (to - mark.at < near) continue;
    ticks.push({ at: mark.at, label: formatLisbonClock(mark.at) });
  }
  ticks.push({ at: to, label: formatLisbonClock(to), now: true });
  return ticks;
}

function formatLisbonClock(at: number) {
  const parts = lisbonParts(new Date(at));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function humidityFromDevice(device?: CasaOwnerDevice) {
  const humidity = device?.reading.humidity;
  return typeof humidity === "number" ? humidity : null;
}

function lisbonParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISBON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function lisbonOffsetMs(value: Date) {
  const parts = lisbonParts(value);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - value.getTime();
}

