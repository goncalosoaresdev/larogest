import type { PulseAlertType } from "@prisma/client";

export type CasaNotifyPrefs = {
  push: boolean;
  water: boolean;
  offline: boolean;
  battery: boolean;
  climate: boolean;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
};

export const DEFAULT_CASA_NOTIFY: CasaNotifyPrefs = {
  push: true,
  water: true,
  offline: true,
  battery: true,
  climate: true,
  quietEnabled: false,
  quietStart: "22:00",
  quietEnd: "08:00",
};

export function parseClockMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isCasaQuietHour(prefs: CasaNotifyPrefs, at = new Date()) {
  if (!prefs.quietEnabled) return false;
  const start = parseClockMinutes(prefs.quietStart);
  const end = parseClockMinutes(prefs.quietEnd);
  if (start == null || end == null || start === end) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const minutes =
    Number(parts.find((part) => part.type === "hour")?.value) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value);
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export function allowCasaNotify(prefs: CasaNotifyPrefs, type: PulseAlertType) {
  if (type === "WATER_LEAK") return prefs.water;
  if (type === "MOTION") return true;
  if (type === "OFFLINE") return prefs.offline;
  if (type === "BATTERY") return prefs.battery;
  if (type === "TEMP_HIGH" || type === "TEMP_LOW" || type === "HUMIDITY_HIGH") return prefs.climate;
  return false;
}
