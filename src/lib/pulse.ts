import type { IoTProvider, Prisma, PulseAlertType, PulseDevice, PulseDeviceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getIoTAdapter, matchProviderLocation } from "@/lib/iot";
import type { ProviderDevice, ProviderLocation } from "@/lib/iot/types";

export const PULSE_SITE_ACTIVE = "ACTIVE";
export const PULSE_SITE_DISABLED = "DISABLED";

export function isPulseSiteActive(status: string) {
  return status !== PULSE_SITE_DISABLED;
}

export const PULSE_DEVICE_ORDER: PulseDeviceKind[] = [
  "WATER",
  "MOTION",
  "TEMP_HUMIDITY",
  "DOOR",
  "GATEWAY",
  "OTHER",
];

const TEMP_LOW = 10;
const TEMP_HIGH = 32;
const HUMIDITY_HIGH = 75;
const BATTERY_LOW = 20;

export type PulseReading = {
  open?: boolean;
  leak?: boolean;
  temperature?: number;
  humidity?: number;
  motion?: boolean;
  lux?: number;
};

export function parsePulsePayload(value: unknown): PulseReading {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const payload = value as Record<string, unknown>;
  return {
    open: typeof payload.open === "boolean" ? payload.open : undefined,
    leak: typeof payload.leak === "boolean" ? payload.leak : undefined,
    temperature: typeof payload.temperature === "number" ? payload.temperature : undefined,
    humidity: typeof payload.humidity === "number" ? payload.humidity : undefined,
    motion: typeof payload.motion === "boolean" ? payload.motion : undefined,
    lux: typeof payload.lux === "number" ? payload.lux : undefined,
  };
}

export function formatPulseHeadline(device: PulseDevice) {
  const reading = parsePulsePayload(device.lastPayload);
  if (!device.online && !device.lastSeenAt) return "Ainda sem leitura";
  if (!device.online) return "Offline";

  if (device.kind === "WATER") {
    if (reading.leak === true) return "Fuga detectada";
    if (reading.leak === false) return "Seco";
    return "Online";
  }
  if (device.kind === "DOOR") {
    if (reading.open === true) return "Aberta";
    if (reading.open === false) return "Fechada";
    return "Online";
  }
  if (device.kind === "TEMP_HUMIDITY") {
    const parts = [
      reading.temperature != null ? `${reading.temperature.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} °C` : null,
      reading.humidity != null ? `${reading.humidity.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} %` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Online";
  }
  if (device.kind === "MOTION") {
    const parts = [
      reading.motion === true ? "Movimento" : reading.motion === false ? "Calmo" : null,
      reading.lux != null ? `${Math.round(reading.lux)} lx` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Online";
  }
  return "Online";
}

export type PulseSeverity = "ok" | "warn" | "alert" | "offline" | "idle";

export function pulseDeviceSeverity(device: {
  kind: PulseDeviceKind;
  online: boolean;
  lastSeenAt: Date | string | null;
  batteryPct: number | null;
  lastPayload?: unknown;
  reading?: PulseReading;
}): PulseSeverity {
  const reading = device.reading ?? parsePulsePayload(device.lastPayload);
  if (!device.lastSeenAt) return "idle";
  if (!device.online) return "offline";
  if (device.kind === "WATER" && reading.leak === true) return "alert";
  if (device.kind === "MOTION" && reading.motion === true) return "warn";
  if (device.kind === "DOOR" && reading.open === true) return "warn";
  if (device.kind === "TEMP_HUMIDITY") {
    if (reading.temperature != null && (reading.temperature < TEMP_LOW || reading.temperature > TEMP_HIGH)) {
      return "warn";
    }
    if (reading.humidity != null && reading.humidity > HUMIDITY_HIGH) return "warn";
  }
  if (device.batteryPct != null && device.batteryPct < BATTERY_LOW) return "warn";
  return "ok";
}

export function pulseHouseHeadline(
  devices: Array<{
    kind: PulseDeviceKind;
    online: boolean;
    lastSeenAt: Date | string | null;
    batteryPct: number | null;
    lastPayload?: unknown;
    reading?: PulseReading;
  }>,
  openAlertCount: number,
) {
  if (devices.some((device) => pulseDeviceSeverity(device) === "alert")) {
    return "Fuga de água";
  }
  if (devices.some((device) => device.kind === "MOTION" && (device.reading ?? parsePulsePayload(device.lastPayload)).motion === true)) {
    return "Movimento detectado";
  }
  if (openAlertCount === 1) return "1 alerta aberto";
  if (openAlertCount > 1) return `${openAlertCount} alertas abertos`;
  const silent = devices.filter((device) => !device.online && device.lastSeenAt).length;
  if (silent === 1) return "1 sensor sem sinal";
  if (silent > 1) return `${silent} sensores sem sinal`;
  if (devices.length === 0) return "À espera dos sensores";
  if (devices.every((device) => !device.lastSeenAt)) return "Ainda sem leitura";
  return "Tudo calmo";
}

export async function createEmptyPulseSite(tx: Prisma.TransactionClient, propertyId: string) {
  return tx.pulseSite.create({
    data: { propertyId },
  });
}

export async function autoLinkPulseSite(
  siteId: string,
  locations?: ProviderLocation[],
): Promise<ProviderLocation | null> {
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    include: { property: { include: { person: true } } },
  });
  if (!site || site.locationId || !isPulseSiteActive(site.status)) return null;

  const adapter = getIoTAdapter(site.provider);
  if (!locations && !adapter.listLocations) return null;

  const taken = (
    await prisma.pulseSite.findMany({
      where: { id: { not: siteId }, locationId: { not: null } },
      select: { locationId: true },
    })
  ).flatMap((item) => (item.locationId ? [item.locationId] : []));

  const match = matchProviderLocation(
    locations ?? (await adapter.listLocations!()),
    {
      address: site.property.address,
      city: site.property.city,
      ownerName: site.property.person.name,
    },
    taken,
  );
  if (!match) return null;

  await prisma.pulseSite.update({
    where: { id: siteId },
    data: { locationId: match.id, locationName: match.name },
  });
  return match;
}

export async function resolveLocationName(provider: IoTProvider, locationId: string | null) {
  if (!locationId) return null;
  const adapter = getIoTAdapter(provider);
  if (!adapter.listLocations) return null;
  const locations = await adapter.listLocations();
  return locations.find((location) => location.id === locationId)?.name ?? null;
}

export async function fillMissingLocationNames() {
  const sites = await prisma.pulseSite.findMany({
    where: { locationId: { not: null }, locationName: null },
    select: { id: true, provider: true, locationId: true },
  });
  if (sites.length === 0) return;

  const byProvider = new Map<string, typeof sites>();
  for (const site of sites) {
    const group = byProvider.get(site.provider) ?? [];
    group.push(site);
    byProvider.set(site.provider, group);
  }

  for (const [, group] of byProvider) {
    const adapter = getIoTAdapter(group[0].provider);
    if (!adapter.listLocations) continue;
    const locations = await adapter.listLocations();
    for (const site of group) {
      const name = locations.find((location) => location.id === site.locationId)?.name;
      if (!name) continue;
      await prisma.pulseSite.update({
        where: { id: site.id },
        data: { locationName: name },
      });
    }
  }
}

export async function autoLinkUnlinkedSites() {
  const sites = await prisma.pulseSite.findMany({
    where: { locationId: null, status: { not: PULSE_SITE_DISABLED } },
    select: { id: true, provider: true },
  });
  if (sites.length === 0) return [];

  const linked: ProviderLocation[] = [];
  const byProvider = new Map<string, typeof sites>();
  for (const site of sites) {
    const group = byProvider.get(site.provider) ?? [];
    group.push(site);
    byProvider.set(site.provider, group);
  }

  for (const [, group] of byProvider) {
    const adapter = getIoTAdapter(group[0].provider);
    if (!adapter.listLocations) continue;
    const locations = await adapter.listLocations();
    for (const site of group) {
      const match = await autoLinkPulseSite(site.id, locations);
      if (match) linked.push(match);
    }
  }
  return linked;
}

export function sortPulseDevices(devices: PulseDevice[]) {
  return [...devices].sort((left, right) => {
    const kind =
      PULSE_DEVICE_ORDER.indexOf(left.kind) - PULSE_DEVICE_ORDER.indexOf(right.kind);
    if (kind !== 0) return kind;
    return left.label.localeCompare(right.label, "pt");
  });
}

export async function syncPulseDevices(
  tx: Prisma.TransactionClient,
  siteId: string,
  remote: ProviderDevice[],
) {
  const existing = await tx.pulseDevice.findMany({ where: { siteId } });
  const byExternalId = new Map(
    existing
      .filter((device) => device.providerDeviceId)
      .map((device) => [device.providerDeviceId!, device]),
  );
  const placeholders = existing.filter((device) => !device.providerDeviceId);

  for (const item of remote) {
    const placeholderIndex = placeholders.findIndex((device) => device.kind === item.kind);
    const current = byExternalId.get(item.id) ?? (placeholderIndex >= 0 ? placeholders[placeholderIndex] : undefined);

    if (placeholderIndex >= 0 && current && placeholders[placeholderIndex]?.id === current.id) {
      placeholders.splice(placeholderIndex, 1);
    }

    const device = current
      ? await tx.pulseDevice.update({
          where: { id: current.id },
          data: {
            providerDeviceId: item.id,
            kind: item.kind,
            label: item.name,
            model: item.model,
            online: item.online,
          },
        })
      : await tx.pulseDevice.create({
          data: {
            siteId,
            providerDeviceId: item.id,
            kind: item.kind,
            label: item.name,
            model: item.model,
            online: item.online,
          },
        });

    byExternalId.set(item.id, device);
    await applyPulseReading(tx, device, {
      online: item.online,
      batteryPct: item.batteryPct ?? device.batteryPct,
      reading: item.reading,
    });
  }

  for (const leftover of placeholders) {
    if (leftover.lastSeenAt) continue;
    await tx.pulseAlert.deleteMany({ where: { deviceId: leftover.id } });
    await tx.pulseDevice.delete({ where: { id: leftover.id } });
  }
}

export type OpenedPulseAlert = { type: PulseAlertType; message: string };

export async function applyPulseReading(
  tx: Prisma.TransactionClient,
  device: PulseDevice,
  input: {
    online: boolean;
    batteryPct: number | null;
    reading: PulseReading;
  },
): Promise<OpenedPulseAlert[]> {
  const previous = parsePulsePayload(device.lastPayload);
  const reading = { ...previous, ...input.reading };
  const now = new Date();
  const sameState =
    device.online === input.online &&
    device.batteryPct === input.batteryPct &&
    previous.open === reading.open &&
    previous.leak === reading.leak &&
    previous.motion === reading.motion &&
    previous.temperature === reading.temperature &&
    previous.humidity === reading.humidity &&
    previous.lux === reading.lux;

  if (sameState) {
    if (input.online && device.lastSeenAt && now.getTime() - device.lastSeenAt.getTime() >= 60_000) {
      await tx.pulseDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: now },
      });
    }
    return [];
  }

  const opened: OpenedPulseAlert[] = [];
  const track = async (type: PulseAlertType, active: boolean, message: string) => {
    if (await setAlert(tx, { siteId: device.siteId, deviceId: device.id, type, active, message })) {
      opened.push({ type, message });
    }
  };

  await tx.pulseDevice.update({
    where: { id: device.id },
    data: {
      online: input.online,
      lastSeenAt: input.online ? now : device.lastSeenAt,
      batteryPct: input.batteryPct,
      lastPayload: reading as Prisma.InputJsonValue,
    },
  });

  await recordPulseSample(tx, device.id, {
    recordedAt: now,
    temperature: reading.temperature,
    humidity: reading.humidity,
    leak: reading.leak,
    open: reading.open,
    motion: reading.motion,
    lux: reading.lux,
    batteryPct: input.batteryPct,
    online: input.online,
  });

  if (device.kind === "WATER") {
    await track("WATER_LEAK", reading.leak === true, "Fuga de água detectada");
  }

  if (device.kind === "MOTION") {
    await track(
      "MOTION",
      reading.motion === true,
      reading.lux != null ? `Movimento detectado (${Math.round(reading.lux)} lx)` : "Movimento detectado",
    );
  }

  if (device.kind === "TEMP_HUMIDITY") {
    await track(
      "TEMP_LOW",
      reading.temperature != null && reading.temperature < TEMP_LOW,
      `Temperatura baixa (${reading.temperature} °C)`,
    );
    await track(
      "TEMP_HIGH",
      reading.temperature != null && reading.temperature > TEMP_HIGH,
      `Temperatura alta (${reading.temperature} °C)`,
    );
    await track(
      "HUMIDITY_HIGH",
      reading.humidity != null && reading.humidity > HUMIDITY_HIGH,
      `Humidade alta (${reading.humidity} %)`,
    );
  }

  await track(
    "BATTERY",
    input.batteryPct != null && input.batteryPct < BATTERY_LOW,
    `Bateria a ${input.batteryPct} %`,
  );

  await track("OFFLINE", !input.online && Boolean(device.lastSeenAt), `${device.label} ficou offline`);
  return opened;
}

const SAMPLE_EVERY_MS = 5 * 60_000;

async function recordPulseSample(
  tx: Prisma.TransactionClient,
  deviceId: string,
  sample: {
    recordedAt: Date;
    temperature?: number;
    humidity?: number;
    leak?: boolean;
    open?: boolean;
    motion?: boolean;
    lux?: number;
    batteryPct: number | null;
    online: boolean;
  },
) {
  if (typeof tx.pulseSample?.findFirst !== "function") return;

  const last = await tx.pulseSample.findFirst({
    where: { deviceId },
    orderBy: { recordedAt: "desc" },
  });
  const stale = !last || sample.recordedAt.getTime() - last.recordedAt.getTime() >= SAMPLE_EVERY_MS;
  const changed =
    !last ||
    last.online !== sample.online ||
    last.leak !== (sample.leak ?? last.leak) ||
    last.open !== (sample.open ?? last.open) ||
    last.motion !== (sample.motion ?? last.motion) ||
    (sample.lux != null && last.lux != null && Math.abs(sample.lux - last.lux) >= 5) ||
    (sample.humidity != null && last.humidity != null && Math.abs(sample.humidity - last.humidity) >= 1) ||
    (sample.temperature != null && last.temperature != null && Math.abs(sample.temperature - last.temperature) >= 0.3) ||
    (sample.batteryPct != null && last.batteryPct != null && Math.abs(sample.batteryPct - last.batteryPct) >= 2);

  if (!stale && !changed) return;

  await tx.pulseSample.create({
    data: {
      deviceId,
      recordedAt: sample.recordedAt,
      temperature: sample.temperature,
      humidity: sample.humidity,
      leak: sample.leak,
      open: sample.open,
      motion: sample.motion,
      lux: sample.lux,
      batteryPct: sample.batteryPct,
      online: sample.online,
    },
  });
}

async function setAlert(
  tx: Prisma.TransactionClient,
  input: {
    siteId: string;
    deviceId: string;
    type: PulseAlertType;
    active: boolean;
    message: string;
  },
) {
  const existing = await tx.pulseAlert.findFirst({
    where: {
      deviceId: input.deviceId,
      type: input.type,
      status: { in: ["OPEN", "ACKED"] },
    },
  });

  if (input.active) {
    if (!existing) {
      await tx.pulseAlert.create({
        data: {
          siteId: input.siteId,
          deviceId: input.deviceId,
          type: input.type,
          message: input.message,
        },
      });
      return true;
    }
    return false;
  }

  if (existing) {
    await tx.pulseAlert.update({
      where: { id: existing.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }
  return false;
}
