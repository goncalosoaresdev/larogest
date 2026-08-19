import type { PulseDeviceKind } from "@prisma/client";
import type { PulseReading } from "@/lib/pulse";
import type { ProviderDevice } from "@/lib/iot/types";

export type TuyaStatusItem = {
  code?: string;
  value?: unknown;
};

const OPEN_CODES = new Set(["doorcontact_state", "switch", "door", "window"]);
const LEAK_CODES = new Set(["watersensor_state", "flood", "leak", "water_leak", "watersensor"]);
const TEMP_CODES = new Set(["va_temperature", "temp_current", "temperature", "temp_value"]);
const HUMIDITY_CODES = new Set(["va_humidity", "humidity_value", "humidity", "rh_value"]);
const MOTION_CODES = new Set([
  "pir",
  "pir_state",
  "pirs",
  "occupancy",
  "occupy",
  "presence",
  "presence_state",
  "human_motion_state",
  "motion_state",
  "movement_detect",
  "movement_state",
  "radar_detect",
  "person_state",
]);
const LUX_CODES = new Set([
  "bright_value",
  "bright_value_v2",
  "illuminance_lux",
  "illuminance_value",
  "illuminance",
  "lux_value",
  "lux",
  "luminance",
  "va_brightness",
  "light_intensity",
]);
const BATTERY_CODES = new Set(["battery_percentage", "battery_percentage_remain", "va_battery", "battery"]);
const BATTERY_STATE_CODES = new Set(["battery_state", "battery_status"]);

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === true || value === 1 || value === "1") return true;
  if (value === "false" || value === false || value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalised = value.toLowerCase();
    if (
      ["alarm", "leak", "wet", "open", "pir", "motion", "presence", "occupied", "detected", "occupy"].includes(
        normalised,
      )
    ) {
      return true;
    }
    if (
      ["normal", "dry", "close", "closed", "none", "nomotion", "unoccupied", "no_one", "nobody", "clear"].includes(
        normalised,
      )
    ) {
      return false;
    }
  }
  return undefined;
}

function asMotion(value: unknown): boolean | undefined {
  const direct = asBoolean(value);
  if (direct != null) return direct;
  if (typeof value !== "string") return undefined;
  const normalised = value.toLowerCase();
  if (["small_move", "large_move", "static", "move"].includes(normalised)) return true;
  return undefined;
}

function asNumber(value: unknown, scale = 1): number | undefined {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return undefined;
  return amount / scale;
}

function scaleFor(code: string) {
  return code === "va_temperature" || code === "temp_current" ? 10 : 1;
}

function batteryFromState(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const normalised = value.toLowerCase();
  if (["low", "powerlow", "lack"].includes(normalised)) return 10;
  if (["middle", "medium", "mid"].includes(normalised)) return 50;
  if (["high", "full", "powerhigh"].includes(normalised)) return 100;
  return undefined;
}

export function readingFromTuyaStatus(status: TuyaStatusItem[]): {
  reading: PulseReading;
  batteryPct: number | null;
} {
  const reading: PulseReading = {};
  let batteryPct: number | null = null;

  for (const item of status) {
    const code = item.code ?? "";
    if (OPEN_CODES.has(code)) {
      const open = asBoolean(item.value);
      if (open != null) reading.open = open;
    }
    if (LEAK_CODES.has(code)) {
      const leak = asBoolean(item.value);
      if (leak != null) reading.leak = leak;
    }
    if (TEMP_CODES.has(code)) {
      const temperature = asNumber(item.value, scaleFor(code));
      if (temperature != null) reading.temperature = temperature;
    }
    if (HUMIDITY_CODES.has(code)) {
      const humidity = asNumber(item.value);
      if (humidity != null) reading.humidity = humidity > 100 ? humidity / 10 : humidity;
    }
    if (MOTION_CODES.has(code)) {
      const motion = asMotion(item.value);
      if (motion != null) reading.motion = motion;
    }
    if (LUX_CODES.has(code)) {
      const lux = asNumber(item.value);
      if (lux != null) reading.lux = lux;
    }
    if (BATTERY_CODES.has(code)) {
      const battery = asNumber(item.value);
      if (battery != null) batteryPct = Math.round(battery);
    }
    if (BATTERY_STATE_CODES.has(code)) {
      const battery = batteryFromState(item.value);
      if (battery != null) batteryPct = battery;
    }
  }

  return { reading, batteryPct };
}

export type TuyaHomeDevice = {
  id?: string;
  uid?: string;
  name?: string;
  category?: string;
  product_name?: string;
  online?: boolean;
  sub?: boolean;
  owner_id?: string;
  status?: TuyaStatusItem[];
};

export function pulseKindFromTuya(device: TuyaHomeDevice): PulseDeviceKind {
  const codes = new Set((device.status ?? []).map((item) => item.code ?? ""));
  if ([...codes].some((code) => LEAK_CODES.has(code))) return "WATER";
  if ([...codes].some((code) => MOTION_CODES.has(code) || LUX_CODES.has(code))) return "MOTION";
  if ([...codes].some((code) => OPEN_CODES.has(code))) return "DOOR";
  if ([...codes].some((code) => TEMP_CODES.has(code) || HUMIDITY_CODES.has(code))) {
    return "TEMP_HUMIDITY";
  }

  const category = (device.category ?? "").toLowerCase();
  const haystack = `${device.name ?? ""} ${device.product_name ?? ""} ${category}`.toLowerCase();

  if (["sj", "sos"].includes(category) || /water|leak|flood|fuga|água|agua/.test(haystack)) {
    return "WATER";
  }
  if (["pir", "pirs", "hps", "ldcg"].includes(category) || /motion|movimento|presen|occupan|pir|lumin|lux|illumin|radar/.test(haystack)) {
    return "MOTION";
  }
  if (category === "mcs" || /door|window|contact|porta|janela|magnet/.test(haystack)) {
    return "DOOR";
  }
  if (category === "wsdcg" || /temp|humid/.test(haystack)) return "TEMP_HUMIDITY";
  if (device.sub === false || category.startsWith("wg") || /gateway|hub|wfcon/.test(haystack)) {
    return "GATEWAY";
  }
  return "OTHER";
}

export function toProviderDevice(device: TuyaHomeDevice): ProviderDevice | null {
  if (!device.id) return null;
  const { reading, batteryPct } = readingFromTuyaStatus(device.status ?? []);
  return {
    id: device.id,
    name: device.name?.trim() || device.product_name?.trim() || device.id,
    model: device.product_name?.trim() || device.category || "Tuya",
    kind: pulseKindFromTuya(device),
    online: Boolean(device.online),
    reading,
    batteryPct,
    locationId: device.owner_id?.trim() || undefined,
  };
}
