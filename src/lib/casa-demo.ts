import type { PrismaClient } from "@prisma/client";
import { startOfLisbonDay } from "./casa-day";

export const CASA_DEMO_SLUG = "demo";

export const CASA_DEMO = {
  ownerId: "seed-owner",
  ownerEmail: "demo@laro.pt",
  personId: "seed-owner-person",
  propertyId: "seed-property-ericeira",
  siteId: "seed-site-ericeira",
  reportId: "seed-report-ericeira",
  stickyAlertId: "seed-alert-open",
  devices: {
    gateway: "seed-dev-gateway",
    door: "seed-dev-door",
    climate: "seed-dev-climate",
    water: "seed-dev-water",
    motion: "seed-dev-motion",
  },
} as const;

const STORY_MAX_AGE_MS = 25 * 60_000;
const TOUCH_MAX_AGE_MS = 90_000;

export function isCasaDemoSlug(siteId: string) {
  return siteId === CASA_DEMO_SLUG || siteId === CASA_DEMO.siteId;
}

export function resolveCasaSiteId(siteId: string) {
  return siteId === CASA_DEMO_SLUG ? CASA_DEMO.siteId : siteId;
}

/** Always today, a few hours back when possible, so the home ribbon keeps a bead. */
export function stickyDemoAlertAt(now: Date) {
  const from = startOfLisbonDay(now).getTime();
  const earliest = from + 60_000;
  const latest = now.getTime() - 60_000;
  if (latest <= earliest) return new Date(Math.max(from, now.getTime() - 30_000));
  const preferred = now.getTime() - 3 * 3_600_000;
  return new Date(Math.min(latest, Math.max(earliest, preferred)));
}

/** Full seed for `prisma/seed.ts`. Do not call from public request handlers. */
export async function ensureDemoCasa(db: PrismaClient, now = new Date()) {
  await upsertDemoHouse(db);
  await refreshDemoCasa(db, now);
}

/**
 * Cheap live-path refresh. Never creates or updates User/Person/Property.
 * Skips writes when devices and the sticky alert were touched recently.
 */
export async function refreshDemoCasa(db: PrismaClient, now = new Date()) {
  const site = await db.pulseSite.findUnique({
    where: { id: CASA_DEMO.siteId },
    select: { demo: true },
  });
  if (!site?.demo) return false;

  const stickyAt = stickyDemoAlertAt(now);
  const start = startOfLisbonDay(now).getTime();
  const [water, sticky] = await Promise.all([
    db.pulseDevice.findUnique({
      where: { id: CASA_DEMO.devices.water },
      select: { lastSeenAt: true },
    }),
    db.pulseAlert.findUnique({
      where: { id: CASA_DEMO.stickyAlertId },
      select: { status: true, triggeredAt: true },
    }),
  ]);
  const devicesFresh = Boolean(
    water?.lastSeenAt && now.getTime() - water.lastSeenAt.getTime() < TOUCH_MAX_AGE_MS,
  );
  const stickyFresh = sticky?.status === "OPEN" && sticky.triggeredAt.getTime() >= start;
  if (devicesFresh && stickyFresh && (await demoStoryIsFresh(db, now, stickyAt))) {
    return true;
  }

  await touchDemoDevices(db, now);
  if (!(await demoStoryIsFresh(db, now, stickyAt))) {
    await rebuildDemoStory(db, now, stickyAt);
  } else {
    await upsertStickyAlert(db, stickyAt);
  }
  return true;
}

async function upsertDemoHouse(db: PrismaClient) {
  await db.user.upsert({
    where: { id: CASA_DEMO.ownerId },
    update: { name: "Maria Santos", email: CASA_DEMO.ownerEmail, role: "OWNER", emailVerified: true },
    create: {
      id: CASA_DEMO.ownerId,
      name: "Maria Santos",
      email: CASA_DEMO.ownerEmail,
      emailVerified: true,
      role: "OWNER",
    },
  });

  await db.person.upsert({
    where: { id: CASA_DEMO.personId },
    update: { name: "Maria Santos", email: CASA_DEMO.ownerEmail, userId: CASA_DEMO.ownerId },
    create: {
      id: CASA_DEMO.personId,
      name: "Maria Santos",
      email: CASA_DEMO.ownerEmail,
      phone: "+351 910 000 000",
      type: "INDIVIDUAL",
      userId: CASA_DEMO.ownerId,
    },
  });

  await db.property.upsert({
    where: { id: CASA_DEMO.propertyId },
    update: { address: "Estrada da Serra", city: null, typology: "HOUSE" },
    create: {
      id: CASA_DEMO.propertyId,
      personId: CASA_DEMO.personId,
      address: "Estrada da Serra",
      city: null,
      typology: "HOUSE",
      capacity: 8,
    },
  });

  await db.pulseSite.upsert({
    where: { id: CASA_DEMO.siteId },
    update: {
      status: "ACTIVE",
      demo: true,
      locationId: null,
      notes: "Casa demo pública — Casa de Campo",
    },
    create: {
      id: CASA_DEMO.siteId,
      propertyId: CASA_DEMO.propertyId,
      status: "ACTIVE",
      provider: "TUYA",
      demo: true,
      notes: "Casa demo pública — Casa de Campo",
    },
  });

  await db.pulseNotifySettings.upsert({
    where: { siteId: CASA_DEMO.siteId },
    update: { push: false },
    create: { siteId: CASA_DEMO.siteId, push: false },
  });
}

async function touchDemoDevices(db: PrismaClient, now: Date) {
  const seen = new Date(now.getTime() - 2 * 60_000);
  const climate = climateAt(now);

  await upsertDemoDevice(db, {
    id: CASA_DEMO.devices.gateway,
    kind: "GATEWAY",
    label: "Gateway",
    model: "Laro Hub",
    online: true,
    lastSeenAt: seen,
    batteryPct: null,
    lastPayload: {},
  });
  await upsertDemoDevice(db, {
    id: CASA_DEMO.devices.door,
    kind: "DOOR",
    label: "Porta principal",
    model: "Door sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 64,
    lastPayload: { open: false },
  });
  await upsertDemoDevice(db, {
    id: CASA_DEMO.devices.climate,
    kind: "TEMP_HUMIDITY",
    label: "Sala",
    model: "Climate sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 81,
    lastPayload: climate,
  });
  await upsertDemoDevice(db, {
    id: CASA_DEMO.devices.water,
    kind: "WATER",
    label: "Cozinha",
    model: "Leak sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 87,
    lastPayload: { leak: true },
  });
  await upsertDemoDevice(db, {
    id: CASA_DEMO.devices.motion,
    kind: "MOTION",
    label: "Hall",
    model: "Motion sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 91,
    lastPayload: { motion: false, lux: climate.lux, lastMotionAt: hoursAgo(now, 5.1).toISOString() },
  });
}

async function demoStoryIsFresh(db: PrismaClient, now: Date, stickyAt: Date) {
  const latest = await db.pulseSample.findFirst({
    where: { device: { siteId: CASA_DEMO.siteId } },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });
  if (!latest) return false;
  if (now.getTime() - latest.recordedAt.getTime() > STORY_MAX_AGE_MS) return false;
  const sticky = await db.pulseAlert.findUnique({
    where: { id: CASA_DEMO.stickyAlertId },
    select: { status: true, triggeredAt: true },
  });
  if (!sticky || sticky.status !== "OPEN") return false;
  const start = startOfLisbonDay(now).getTime();
  return sticky.triggeredAt.getTime() >= start && sticky.triggeredAt.getTime() <= stickyAt.getTime() + 60_000;
}

async function rebuildDemoStory(db: PrismaClient, now: Date, stickyAt: Date) {
  await db.pulseSample.deleteMany({ where: { device: { siteId: CASA_DEMO.siteId } } });
  await db.pulseAlert.deleteMany({ where: { siteId: CASA_DEMO.siteId } });

  const leakStart = hoursAgo(now, 68);
  const leakEnd = hoursAgo(now, 67.6);
  const humidStart = hoursAgo(now, 22);
  const humidEnd = hoursAgo(now, 20.4);
  const doorStart = hoursAgo(now, 18);
  const doorEnd = hoursAgo(now, 17.3);
  const moveStart = hoursAgo(now, 5.4);
  const moveEnd = hoursAgo(now, 5.1);

  await db.pulseSample.createMany({
    data: demoSamples(now, stickyAt, { leakStart, leakEnd, humidStart, humidEnd, doorStart, doorEnd, moveStart, moveEnd }),
  });

  await db.pulseAlert.createMany({
    data: [
      {
        siteId: CASA_DEMO.siteId,
        deviceId: CASA_DEMO.devices.water,
        type: "WATER_LEAK",
        status: "RESOLVED",
        message: "Fuga de água detectada",
        triggeredAt: leakStart,
        resolvedAt: leakEnd,
      },
      {
        siteId: CASA_DEMO.siteId,
        deviceId: CASA_DEMO.devices.climate,
        type: "HUMIDITY_HIGH",
        status: "RESOLVED",
        message: "Humidade alta (79 %)",
        triggeredAt: humidStart,
        resolvedAt: humidEnd,
      },
      {
        siteId: CASA_DEMO.siteId,
        deviceId: CASA_DEMO.devices.door,
        type: "DOOR_OPEN",
        status: "RESOLVED",
        message: "Porta ou janela aberta",
        triggeredAt: doorStart,
        resolvedAt: doorEnd,
      },
      {
        siteId: CASA_DEMO.siteId,
        deviceId: CASA_DEMO.devices.motion,
        type: "MOTION",
        status: "RESOLVED",
        message: "Movimento detectado (42 lx)",
        triggeredAt: moveStart,
        resolvedAt: moveEnd,
      },
    ],
  });
  await upsertStickyAlert(db, stickyAt);
  await upsertDemoReport(db, now);
}

async function upsertStickyAlert(db: PrismaClient, stickyAt: Date) {
  await db.pulseAlert.upsert({
    where: { id: CASA_DEMO.stickyAlertId },
    update: {
      siteId: CASA_DEMO.siteId,
      deviceId: CASA_DEMO.devices.water,
      type: "WATER_LEAK",
      status: "OPEN",
      message: "Fuga de água detectada",
      triggeredAt: stickyAt,
      resolvedAt: null,
    },
    create: {
      id: CASA_DEMO.stickyAlertId,
      siteId: CASA_DEMO.siteId,
      deviceId: CASA_DEMO.devices.water,
      type: "WATER_LEAK",
      status: "OPEN",
      message: "Fuga de água detectada",
      triggeredAt: stickyAt,
      resolvedAt: null,
    },
  });
}

async function upsertDemoReport(db: PrismaClient, now: Date) {
  await db.careReport.upsert({
    where: { id: CASA_DEMO.reportId },
    update: {
      visitedAt: hoursAgo(now, 26),
      visitedByName: "Gonçalo",
      verdict: "OK",
      summary: "Casa arejada, sem cheiros. Recolhemos o correio e confirmámos portas e água.",
      nextVisitAt: hoursAgo(now, -80),
      status: "PUBLISHED",
      publishedAt: hoursAgo(now, 25),
    },
    create: {
      id: CASA_DEMO.reportId,
      propertyId: CASA_DEMO.propertyId,
      visitedAt: hoursAgo(now, 26),
      visitedByName: "Gonçalo",
      verdict: "OK",
      summary: "Casa arejada, sem cheiros. Recolhemos o correio e confirmámos portas e água.",
      nextVisitAt: hoursAgo(now, -80),
      status: "PUBLISHED",
      publishedAt: hoursAgo(now, 25),
    },
  });
  await db.careReportItem.deleteMany({ where: { reportId: CASA_DEMO.reportId } });
  await db.careReportItem.createMany({
    data: [
      { reportId: CASA_DEMO.reportId, key: "DOORS", status: "DONE", note: "Fechadas e trancadas.", sortOrder: 0 },
      { reportId: CASA_DEMO.reportId, key: "WINDOWS", status: "DONE", note: "Arejámos 20 minutos.", sortOrder: 1 },
      { reportId: CASA_DEMO.reportId, key: "MAIL", status: "DONE", note: "Correspondência na gaveta da cozinha.", sortOrder: 2 },
      { reportId: CASA_DEMO.reportId, key: "AIR", status: "DONE", note: null, sortOrder: 3 },
      { reportId: CASA_DEMO.reportId, key: "WATER", status: "DONE", note: "Sem fugas.", sortOrder: 4 },
      { reportId: CASA_DEMO.reportId, key: "LIGHTS", status: "DONE", note: null, sortOrder: 5 },
      { reportId: CASA_DEMO.reportId, key: "WASTE", status: "SKIPPED", note: null, sortOrder: 6 },
      { reportId: CASA_DEMO.reportId, key: "EXTERIOR", status: "DONE", note: "Pátio em ordem.", sortOrder: 7 },
    ],
  });
}

async function upsertDemoDevice(
  db: PrismaClient,
  data: {
    id: string;
    kind: "GATEWAY" | "DOOR" | "TEMP_HUMIDITY" | "WATER" | "MOTION";
    label: string;
    model: string;
    online: boolean;
    lastSeenAt: Date;
    batteryPct: number | null;
    lastPayload: object;
  },
) {
  await db.pulseDevice.upsert({
    where: { id: data.id },
    update: {
      kind: data.kind,
      label: data.label,
      model: data.model,
      online: data.online,
      lastSeenAt: data.lastSeenAt,
      batteryPct: data.batteryPct,
      lastPayload: data.lastPayload,
      providerDeviceId: `demo-${data.id}`,
    },
    create: {
      id: data.id,
      siteId: CASA_DEMO.siteId,
      kind: data.kind,
      label: data.label,
      model: data.model,
      online: data.online,
      lastSeenAt: data.lastSeenAt,
      batteryPct: data.batteryPct,
      lastPayload: data.lastPayload,
      providerDeviceId: `demo-${data.id}`,
    },
  });
}

function demoSamples(
  now: Date,
  stickyAt: Date,
  events: {
    leakStart: Date;
    leakEnd: Date;
    humidStart: Date;
    humidEnd: Date;
    doorStart: Date;
    doorEnd: Date;
    moveStart: Date;
    moveEnd: Date;
  },
) {
  const rows: Array<{
    deviceId: string;
    recordedAt: Date;
    temperature: number | null;
    humidity: number | null;
    leak: boolean | null;
    open: boolean | null;
    motion: boolean | null;
    lux: number | null;
    batteryPct: number | null;
    online: boolean;
  }> = [];
  const step = 15 * 60_000;
  const from = now.getTime() - 4 * 24 * 60 * 60_000;

  for (let at = from; at <= now.getTime(); at += step) {
    const recordedAt = new Date(at);
    const climate = climateAt(recordedAt);
    const leaking =
      between(recordedAt, events.leakStart, events.leakEnd) || recordedAt >= stickyAt;
    const humid = between(recordedAt, events.humidStart, events.humidEnd);
    const open = between(recordedAt, events.doorStart, events.doorEnd);
    const moving = between(recordedAt, events.moveStart, events.moveEnd);

    rows.push({
      deviceId: CASA_DEMO.devices.climate,
      recordedAt,
      temperature: climate.temperature,
      humidity: humid ? 79 : climate.humidity,
      leak: null,
      open: null,
      motion: null,
      lux: null,
      batteryPct: 81,
      online: true,
    });
    rows.push({
      deviceId: CASA_DEMO.devices.door,
      recordedAt,
      temperature: null,
      humidity: null,
      leak: null,
      open,
      motion: null,
      lux: null,
      batteryPct: 64,
      online: true,
    });
    rows.push({
      deviceId: CASA_DEMO.devices.water,
      recordedAt,
      temperature: null,
      humidity: null,
      leak: leaking,
      open: null,
      motion: null,
      lux: null,
      batteryPct: 87,
      online: true,
    });
    rows.push({
      deviceId: CASA_DEMO.devices.motion,
      recordedAt,
      temperature: null,
      humidity: null,
      leak: null,
      open: null,
      motion: moving,
      lux: moving ? 42 : climate.lux,
      batteryPct: 91,
      online: true,
    });
  }

  return rows;
}

function climateAt(at: Date) {
  const hour = lisbonHour(at) + at.getMinutes() / 60;
  const wave = Math.sin(((hour - 8) / 24) * Math.PI * 2);
  return {
    temperature: round1(22.4 + 4.8 * wave),
    humidity: Math.round(58 - 11 * wave),
    lux: Math.max(2, Math.round(8 + 220 * Math.max(0, Math.sin(((hour - 7) / 13) * Math.PI)))),
  };
}

function lisbonHour(at: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "numeric", hourCycle: "h23" }).format(at),
  );
}

function hoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 3_600_000);
}

function between(at: Date, start: Date, end: Date) {
  return at >= start && at <= end;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
