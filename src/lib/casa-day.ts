import type { PulseAlert, PulseSample } from "@prisma/client";
import type { CasaOwnerAlert, CasaOwnerDevice } from "@/lib/casa";
import { casaAlertTypeLabel, casaText, type CasaLocale } from "@/lib/casa-locale";

const LISBON = "Europe/Lisbon";

export const CASA_CHART_WINDOW_MS = 4 * 3_600_000;

export type CasaDayPoint = {
  at: number;
  humidity: number;
};

export type CasaDayMark = {
  id: string;
  at: number;
  humidity: number;
  kind: "now" | "event";
  label: string;
  detail: string;
  tone: "ok" | "warn" | "alert";
};

export type CasaDayTick = {
  at: number;
  label: string;
  now?: boolean;
};

export type CasaDay = {
  points: CasaDayPoint[];
  marks: CasaDayMark[];
  ticks: CasaDayTick[];
  from: number;
  to: number;
  nowAt: number;
  humidity: number | null;
  domain: { min: number; max: number };
};

export function startOfLisbonDay(now = new Date()) {
  const parts = lisbonParts(now);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) - lisbonOffsetMs(now));
}

export function buildCasaDay(input: {
  devices: CasaOwnerDevice[];
  alerts: Array<Pick<PulseAlert, "id" | "type" | "status" | "triggeredAt"> | CasaOwnerAlert>;
  samples?: PulseSample[];
  now?: Date;
  locale?: CasaLocale;
}): CasaDay {
  const now = input.now ?? new Date();
  const from = startOfLisbonDay(now).getTime();
  const to = now.getTime();
  const climate = input.devices.find((device) => device.kind === "TEMP_HUMIDITY");
  const humidity = humidityFromDevice(climate);
  const lastSeen = climate?.lastSeenAt ? new Date(climate.lastSeenAt).getTime() : to;
  const nowAt = climate && !climate.online && climate.lastSeenAt ? Math.min(to, Math.max(from, lastSeen)) : to;

  const points = sampleHumiditySeries(input.samples ?? [], climate?.id, from, nowAt, humidity);
  const domain = humidityDomain(points, humidity);
  const marks = dayMarks({
    alerts: input.alerts,
    from,
    to: nowAt,
    humidity,
    points,
    offline: Boolean(climate && !climate.online && climate.lastSeenAt),
    locale: input.locale ?? "pt",
  });

  return {
    points,
    marks,
    ticks: dayTicks(from, nowAt),
    from,
    to: nowAt,
    nowAt,
    humidity,
    domain,
  };
}

export function humidityAt(points: CasaDayPoint[], at: number) {
  if (points.length === 0) return null;
  if (at <= points[0].at) return points[0].humidity;
  const last = points[points.length - 1];
  if (at >= last.at) return last.humidity;
  const nextIndex = points.findIndex((point) => point.at >= at);
  const right = points[nextIndex];
  const left = points[nextIndex - 1];
  if (!left || !right) return last.humidity;
  const span = right.at - left.at || 1;
  return left.humidity + ((right.humidity - left.humidity) * (at - left.at)) / span;
}

export function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${fmt(points[0].x)} ${fmt(points[0].y)}`;
  if (points.length === 2) {
    return `M${fmt(points[0].x)} ${fmt(points[0].y)} L${fmt(points[1].x)} ${fmt(points[1].y)}`;
  }

  const parts = [`M${fmt(points[0].x)} ${fmt(points[0].y)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(
      `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`,
    );
  }
  return parts.join(" ");
}

function sampleHumiditySeries(
  samples: PulseSample[],
  climateId: string | undefined,
  from: number,
  to: number,
  humidityNow: number | null,
): CasaDayPoint[] {
  const points = samples
    .filter((sample) => sample.deviceId === climateId && sample.humidity != null)
    .map((sample) => ({
      at: new Date(sample.recordedAt).getTime(),
      humidity: sample.humidity as number,
    }))
    .filter((point) => point.at >= from && point.at <= to)
    .sort((left, right) => left.at - right.at);

  if (humidityNow != null) {
    const last = points[points.length - 1];
    if (!last || to - last.at > 15_000 || Math.abs(last.humidity - humidityNow) >= 0.2) {
      points.push({ at: to, humidity: humidityNow });
    } else {
      last.at = to;
      last.humidity = humidityNow;
    }
  }

  return points;
}

function dayMarks(input: {
  alerts: Array<Pick<PulseAlert, "id" | "type" | "status" | "triggeredAt"> | CasaOwnerAlert>;
  from: number;
  to: number;
  humidity: number | null;
  points: CasaDayPoint[];
  offline: boolean;
  locale: CasaLocale;
}): CasaDayMark[] {
  const marks: CasaDayMark[] = [];

  for (const alert of input.alerts) {
    const at = new Date(alert.triggeredAt).getTime();
    if (at < input.from || at > input.to) continue;
    const humidity = humidityAt(input.points, at) ?? input.humidity ?? 54;
    const resolved = alert.status === "RESOLVED" || alert.status === "ACKED";
    marks.push({
      id: alert.id,
      at,
      humidity,
      kind: "event",
      label: casaAlertTypeLabel(input.locale, alert.type),
      detail: resolved ? casaText(input.locale, "chart.resolved") : casaText(input.locale, "chart.open"),
      tone: !resolved || alert.type === "WATER_LEAK" ? "alert" : "warn",
    });
  }

  if (input.humidity != null) {
    marks.push({
      id: "now",
      at: input.to,
      humidity: input.humidity,
      kind: "now",
      label: input.offline ? casaText(input.locale, "chart.lastReading") : casaText(input.locale, "chart.now"),
      detail: input.offline ? casaText(input.locale, "chart.offline") : casaText(input.locale, "today.humidity"),
      tone: input.offline ? "warn" : "ok",
    });
  }

  return marks;
}

function dayTicks(from: number, to: number): CasaDayTick[] {
  const gap = 25 * 60_000;
  const ticks: CasaDayTick[] = [{ at: from, label: formatLisbonClock(from) }];
  let cursor = startOfLisbonHour(new Date(from)).getTime();
  if (cursor < from + gap) cursor += 3_600_000;
  while (cursor <= to - gap) {
    ticks.push({ at: cursor, label: formatLisbonClock(cursor) });
    cursor += 3_600_000;
  }
  ticks.push({ at: to, label: formatLisbonClock(to), now: true });
  return ticks;
}

function startOfLisbonHour(value: Date) {
  const parts = lisbonParts(value);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, 0, 0) - lisbonOffsetMs(value));
}

function formatLisbonClock(at: number) {
  const parts = lisbonParts(new Date(at));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function humidityDomain(points: CasaDayPoint[], humidity: number | null) {
  const values = points.map((point) => point.humidity);
  if (humidity != null) values.push(humidity);
  if (values.length === 0) return { min: 40, max: 70 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(6, (max - min) * 0.28);
  return {
    min: Math.max(20, Math.floor((min - pad) / 5) * 5),
    max: Math.min(100, Math.ceil((max + pad) / 5) * 5),
  };
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

function fmt(value: number) {
  return value.toFixed(2);
}
