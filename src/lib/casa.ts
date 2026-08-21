import type { PulseAlert, PulseDevice, PulseSample } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { resolveCasaSiteId } from "@/lib/casa-demo";
import { ownerCanAccessSite, siteOwnerLookup } from "@/lib/owner-auth";
import { prisma } from "@/lib/prisma";
import { buildCasaDay, startOfLisbonDay } from "@/lib/casa-day";
import {
  isPulseSiteActive,
  parsePulsePayload,
  PULSE_SITE_DISABLED,
  pulseDeviceSeverity,
  pulseHouseHeadline,
  sortPulseDevices,
  type PulseReading,
  type PulseSeverity,
} from "@/lib/pulse";
import { getSession, getSessionRole, type AuthSession } from "@/lib/session";

export type CasaTone = "ok" | "warn" | "alert" | "offline" | "idle";

export type CasaDeviceSnapshot = {
  id: string;
  kind: PulseDevice["kind"];
  label: string;
  model: string;
  online: boolean;
  lastSeenAt: string | null;
  batteryPct: number | null;
  reading: PulseReading;
  severity: PulseSeverity;
  headline: string;
};

export type CasaAlertSnapshot = {
  id: string;
  type: PulseAlert["type"];
  status: PulseAlert["status"];
  message: string;
  triggeredAt: string;
  resolvedAt: string | null;
  deviceId: string | null;
};

export type CasaSampleSnapshot = {
  id: string;
  deviceId: string;
  recordedAt: string;
  temperature: number | null;
  humidity: number | null;
  leak: boolean | null;
  open: boolean | null;
  motion: boolean | null;
  lux: number | null;
  batteryPct: number | null;
  online: boolean;
};

export type CasaSnapshot = {
  house: {
    name: string;
    ownerName: string;
    address: string;
    city: string | null;
    status: string;
    active: boolean;
  };
  houses: CasaHouseOption[];
  headline: string;
  tone: CasaTone;
  updatedAt: string;
  devices: CasaDeviceSnapshot[];
  alerts: CasaAlertSnapshot[];
  today: {
    samples: CasaSampleSnapshot[];
    day: ReturnType<typeof buildCasaDay>;
  };
};

export type CasaHouseOption = {
  siteId: string;
  name: string;
  address: string;
  city: string | null;
};

export type CasaOwnerDevice = {
  id: string;
  kind: PulseDevice["kind"];
  label: string;
  online: boolean;
  lastSeenAt: string | null;
  batteryPct: number | null;
  reading: PulseReading;
};

export type CasaOwnerAlert = {
  id: string;
  type: PulseAlert["type"];
  status: PulseAlert["status"];
  message: string;
  triggeredAt: string;
  deviceId: string | null;
};

export type CasaHouse = {
  ownerName: string;
  address: string;
  city: string | null;
  status: string;
  houses: CasaHouseOption[];
  devices: CasaOwnerDevice[];
  alerts: CasaOwnerAlert[];
  samples: PulseSample[];
  now: Date;
};

type CasaSitePerson = {
  id: string;
  property: { person: { userId: string | null; email: string | null } };
};

export function toCasaOwnerDevice(device: PulseDevice): CasaOwnerDevice {
  return {
    id: device.id,
    kind: device.kind,
    label: device.label,
    online: device.online,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    batteryPct: device.batteryPct,
    reading: parsePulsePayload(device.lastPayload),
  };
}

export function toCasaOwnerAlert(alert: PulseAlert): CasaOwnerAlert {
  return {
    id: alert.id,
    type: alert.type,
    status: alert.status,
    message: alert.message,
    triggeredAt: alert.triggeredAt.toISOString(),
    deviceId: alert.deviceId,
  };
}

export function casaHouseName(city: string | null, address: string) {
  return city ? `Casa de ${city}` : address || "A sua casa";
}

export function canAccessCasaSite(session: AuthSession, site: CasaSitePerson) {
  const role = getSessionRole(session);
  if (role === "STAFF") return true;
  if (role !== "OWNER") return false;
  return ownerCanAccessSite(session.user, site.property.person);
}

export async function requireCasaApiSite(siteId: string, request?: Request) {
  const id = resolveCasaSiteId(siteId);
  const site = await prisma.pulseSite.findUnique({
    where: { id },
    include: { property: { include: { person: true } } },
  });
  const write = Boolean(request && request.method !== "GET" && request.method !== "HEAD");
  if (site?.demo) {
    if (write || !isPulseSiteActive(site.status)) {
      return { site: null, error: jsonError(404, "not_found") };
    }
    return { site, error: null };
  }

  const session = await getSession(request);
  if (!session?.user) return { site: null, error: jsonError(401, "unauthenticated") };
  if (!site || !isPulseSiteActive(site.status) || !canAccessCasaSite(session, site)) {
    return { site: null, error: jsonError(404, "not_found") };
  }

  return { site, error: null };
}

export async function requireCasaApiOwner(request?: Request) {
  const session = await getSession(request);
  if (!session?.user || getSessionRole(session) !== "OWNER") {
    return { session: null, error: jsonError(401, "unauthenticated") };
  }
  return { session, error: null };
}

export async function listSiteOwnerUserIds(siteId: string) {
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    select: { property: { select: { person: { select: { userId: true, email: true } } } } },
  });
  const lookup = site ? siteOwnerLookup(site.property.person) : null;
  if (!lookup) return [];
  const owners = await prisma.user.findMany({
    where: {
      role: "OWNER",
      ...(lookup.by === "userId"
        ? { id: lookup.userId }
        : { email: { equals: lookup.email, mode: "insensitive" } }),
    },
    select: { id: true },
  });
  return owners.map((owner) => owner.id);
}

export async function listOwnerHouses(userId: string): Promise<CasaHouseOption[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return [];

  const sites = await prisma.pulseSite.findMany({
    where: {
      status: { not: PULSE_SITE_DISABLED },
      demo: false,
      property: {
        person: {
          OR: [
            { userId },
            { userId: null, email: { equals: user.email, mode: "insensitive" } },
          ],
        },
      },
    },
    select: {
      id: true,
      property: { select: { address: true, city: true } },
    },
    orderBy: [{ property: { city: "asc" } }, { property: { address: "asc" } }],
  });

  return sites.map((site) => ({
    siteId: site.id,
    name: casaHouseName(site.property.city, site.property.address),
    address: site.property.address,
    city: site.property.city,
  }));
}

function toHouseOption(site: {
  id: string;
  property: { address: string; city: string | null };
}): CasaHouseOption {
  return {
    siteId: site.id,
    name: casaHouseName(site.property.city, site.property.address),
    address: site.property.address,
    city: site.property.city,
  };
}

export async function loadCasaHouse(siteId: string): Promise<CasaHouse | null> {
  const now = new Date();
  const start = startOfLisbonDay(now);
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    include: {
      property: { include: { person: true } },
      devices: true,
      alerts: {
        where: {
          OR: [
            { status: { in: ["OPEN", "ACKED"] } },
            { triggeredAt: { gte: start } },
          ],
        },
        orderBy: { triggeredAt: "desc" },
        take: 24,
      },
    },
  });
  if (!site || !isPulseSiteActive(site.status)) return null;

  const siblings = await prisma.pulseSite.findMany({
    where: {
      status: { not: PULSE_SITE_DISABLED },
      demo: false,
      property: { personId: site.property.personId },
    },
    select: {
      id: true,
      property: { select: { address: true, city: true } },
    },
    orderBy: [{ property: { city: "asc" } }, { property: { address: "asc" } }],
  });

  return {
    ownerName: site.property.person.name,
    address: site.property.address,
    city: site.property.city,
    status: site.status,
    houses: siblings.map(toHouseOption),
    devices: sortPulseDevices(site.devices).map(toCasaOwnerDevice),
    alerts: site.alerts.map(toCasaOwnerAlert),
    samples: await loadCasaSamples(site.id, start),
    now,
  };
}

export function toCasaSnapshot(house: CasaHouse): CasaSnapshot {
  const sensors = house.devices.filter((device) => device.kind !== "GATEWAY");
  const openAlerts = house.alerts.filter((alert) => alert.status === "OPEN");
  const headline = ownerHeadline(pulseHouseHeadline(house.devices, openAlerts.length));
  const name = casaHouseName(house.city, house.address);

  return {
    house: {
      name,
      ownerName: house.ownerName,
      address: house.address,
      city: house.city,
      status: house.status,
      active: isPulseSiteActive(house.status),
    },
    houses: house.houses,
    headline,
    tone: houseTone(headline, sensors),
    updatedAt: house.now.toISOString(),
    devices: house.devices.map((device) => ({
      id: device.id,
      kind: device.kind,
      label: device.label,
      model: "",
      online: device.online,
      lastSeenAt: device.lastSeenAt,
      batteryPct: device.batteryPct,
      reading: device.reading,
      severity: pulseDeviceSeverity(device),
      headline: "",
    })),
    alerts: house.alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      status: alert.status,
      message: alert.message,
      triggeredAt: alert.triggeredAt,
      resolvedAt: null,
      deviceId: alert.deviceId,
    })),
    today: {
      samples: house.samples.map((sample) => ({
        id: sample.id,
        deviceId: sample.deviceId,
        recordedAt: sample.recordedAt.toISOString(),
        temperature: sample.temperature,
        humidity: sample.humidity,
        leak: sample.leak,
        open: sample.open,
        motion: sample.motion,
        lux: sample.lux,
        batteryPct: sample.batteryPct,
        online: sample.online,
      })),
      day: buildCasaDay({
        devices: house.devices,
        alerts: house.alerts,
        samples: house.samples,
        now: house.now,
      }),
    },
  };
}

export async function getCasaSnapshot(siteId: string) {
  const house = await loadCasaHouse(siteId);
  return house ? toCasaSnapshot(house) : null;
}

export type CasaLive = {
  now: string;
  devices: CasaOwnerDevice[];
  alerts: CasaOwnerAlert[];
  samples: PulseSample[];
};

export async function loadCasaLive(siteId: string): Promise<CasaLive | null> {
  const now = new Date();
  const start = startOfLisbonDay(now);
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    include: {
      devices: true,
      alerts: {
        where: {
          OR: [
            { status: { in: ["OPEN", "ACKED"] } },
            { triggeredAt: { gte: start } },
          ],
        },
        orderBy: { triggeredAt: "desc" },
        take: 24,
      },
    },
  });
  if (!site || !isPulseSiteActive(site.status)) return null;

  return {
    now: now.toISOString(),
    devices: sortPulseDevices(site.devices).map(toCasaOwnerDevice),
    alerts: site.alerts.map(toCasaOwnerAlert),
    samples: await loadCasaSamples(site.id, start),
  };
}

async function loadCasaSamples(siteId: string, start: Date): Promise<PulseSample[]> {
  try {
    return await prisma.$queryRaw<PulseSample[]>`
      SELECT
        s.id,
        s."deviceId",
        s."recordedAt",
        s.temperature,
        s.humidity,
        s.leak,
        s.open,
        s.motion,
        s.lux,
        s."batteryPct",
        s.online
      FROM "PulseSample" s
      INNER JOIN "PulseDevice" d ON d.id = s."deviceId"
      WHERE d."siteId" = ${siteId}
        AND s."recordedAt" >= ${start}
      ORDER BY s."recordedAt" ASC
    `;
  } catch {
    return [];
  }
}

function houseTone(headline: string, sensors: CasaOwnerDevice[]): CasaTone {
  if (sensors.some((device) => pulseDeviceSeverity(device) === "alert") || headline === "Fuga de água") {
    return "alert";
  }
  if (headline.includes("alerta") || headline.includes("abert") || headline.includes("Movimento")) return "warn";
  if (headline.includes("sem sinal") || sensors.some((device) => pulseDeviceSeverity(device) === "offline")) {
    return "offline";
  }
  if (!sensors.length || sensors.every((device) => !device.lastSeenAt)) return "idle";
  return "ok";
}

function ownerHeadline(headline: string) {
  return headline === "Tudo calmo" ? "Tudo em ordem" : headline;
}
