import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { defaultContractSections, defaultProposalSections } from "../src/lib/default-templates";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_EMAIL ?? "admin@laro.pt";
  const password = process.env.SEED_PASSWORD ?? "larogest123";
  const userId = "seed-admin";

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Laro",
      nif: "000000000",
      address: "Portugal",
      email: "ola@laro.pt",
      phone: "",
      website: "https://laro.pt",
    },
  });

  await prisma.user.upsert({
    where: { email },
    update: { name: "Equipa Laro" },
    create: {
      id: userId,
      name: "Equipa Laro",
      email,
      emailVerified: true,
    },
  });

  const hashed = await hashPassword(password);
  await prisma.account.deleteMany({
    where: { userId, providerId: "credential" },
  });
  await prisma.account.create({
    data: {
      id: "seed-admin-account",
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    },
  });

  const existingProposal = await prisma.template.findFirst({
    where: { type: "PROPOSAL" },
  });
  if (!existingProposal) {
    const template = await prisma.template.create({
      data: {
        type: "PROPOSAL",
        name: "Proposta de gestão de AL",
        version: 1,
        status: "PUBLISHED",
        sections: defaultProposalSections,
        publishedAt: new Date(),
      },
    });
    await prisma.templateRevision.create({
      data: {
        templateId: template.id,
        version: 1,
        sections: defaultProposalSections,
      },
    });
  }

  const existingContract = await prisma.template.findFirst({
    where: { type: "CONTRACT" },
  });
  if (!existingContract) {
    const template = await prisma.template.create({
      data: {
        type: "CONTRACT",
        name: "Contrato de gestão Laro",
        version: 1,
        status: "PUBLISHED",
        sections: defaultContractSections,
        publishedAt: new Date(),
      },
    });
    await prisma.templateRevision.create({
      data: {
        templateId: template.id,
        version: 1,
        sections: defaultContractSections,
      },
    });
  }

  console.log(`Seed OK. Staff: ${email} / ${password}`);
  await seedDemoCasa();
}

const DEMO = {
  ownerId: "seed-owner",
  personId: "seed-owner-person",
  propertyId: "seed-property-ericeira",
  siteId: "seed-site-ericeira",
  reportId: "seed-report-ericeira",
  devices: {
    gateway: "seed-dev-gateway",
    door: "seed-dev-door",
    climate: "seed-dev-climate",
    water: "seed-dev-water",
    motion: "seed-dev-motion",
  },
} as const;

async function seedDemoCasa(now = new Date()) {
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "maria@laro.pt").trim().toLowerCase();

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { name: "Maria Santos", role: "OWNER", emailVerified: true },
    create: {
      id: DEMO.ownerId,
      name: "Maria Santos",
      email: ownerEmail,
      emailVerified: true,
      role: "OWNER",
    },
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

  await prisma.person.upsert({
    where: { id: DEMO.personId },
    update: { name: "Maria Santos", email: ownerEmail, userId: owner.id },
    create: {
      id: DEMO.personId,
      name: "Maria Santos",
      email: ownerEmail,
      phone: "+351 910 000 000",
      type: "INDIVIDUAL",
      userId: owner.id,
    },
  });

  await prisma.property.upsert({
    where: { id: DEMO.propertyId },
    update: { address: "Rua da Fonte 18", city: "Ericeira", typology: "HOUSE" },
    create: {
      id: DEMO.propertyId,
      personId: DEMO.personId,
      address: "Rua da Fonte 18",
      city: "Ericeira",
      typology: "HOUSE",
      capacity: 6,
    },
  });

  await prisma.pulseSite.upsert({
    where: { id: DEMO.siteId },
    update: { status: "ACTIVE", notes: "Casa demo para Pulse / Casa" },
    create: {
      id: DEMO.siteId,
      propertyId: DEMO.propertyId,
      status: "ACTIVE",
      provider: "TUYA",
      notes: "Casa demo para Pulse / Casa",
    },
  });

  await prisma.pulseNotifySettings.upsert({
    where: { siteId: DEMO.siteId },
    update: { push: true },
    create: { siteId: DEMO.siteId, push: true },
  });

  const seen = twoMinutesAgo(now);
  const motionAt = hoursAgo(now, 5.1);

  await upsertDemoDevice({
    id: DEMO.devices.gateway,
    kind: "GATEWAY",
    label: "Gateway",
    model: "Laro Hub",
    online: true,
    lastSeenAt: seen,
    batteryPct: null,
    lastPayload: {},
  });
  await upsertDemoDevice({
    id: DEMO.devices.door,
    kind: "DOOR",
    label: "Porta principal",
    model: "Door sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 64,
    lastPayload: { open: false },
  });
  await upsertDemoDevice({
    id: DEMO.devices.climate,
    kind: "TEMP_HUMIDITY",
    label: "Sala",
    model: "Climate sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 81,
    lastPayload: climateAt(now),
  });
  await upsertDemoDevice({
    id: DEMO.devices.water,
    kind: "WATER",
    label: "Cozinha",
    model: "Leak sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 87,
    lastPayload: { leak: false },
  });
  await upsertDemoDevice({
    id: DEMO.devices.motion,
    kind: "MOTION",
    label: "Hall",
    model: "Motion sensor",
    online: true,
    lastSeenAt: seen,
    batteryPct: 91,
    lastPayload: { motion: false, lux: climateAt(now).lux, lastMotionAt: motionAt.toISOString() },
  });

  await prisma.pulseSample.deleteMany({ where: { device: { siteId: DEMO.siteId } } });
  await prisma.pulseAlert.deleteMany({ where: { siteId: DEMO.siteId } });

  const leakStart = hoursAgo(now, 68);
  const leakEnd = hoursAgo(now, 67.6);
  const humidStart = hoursAgo(now, 22);
  const humidEnd = hoursAgo(now, 20.4);
  const doorStart = hoursAgo(now, 18);
  const doorEnd = hoursAgo(now, 17.3);
  const moveStart = hoursAgo(now, 5.4);
  const moveEnd = hoursAgo(now, 5.1);

  await prisma.pulseSample.createMany({
    data: demoSamples(now, { leakStart, leakEnd, humidStart, humidEnd, doorStart, doorEnd, moveStart, moveEnd }),
  });

  await prisma.pulseAlert.createMany({
    data: [
      {
        siteId: DEMO.siteId,
        deviceId: DEMO.devices.water,
        type: "WATER_LEAK",
        status: "RESOLVED",
        message: "Fuga de água detectada",
        triggeredAt: leakStart,
        resolvedAt: leakEnd,
      },
      {
        siteId: DEMO.siteId,
        deviceId: DEMO.devices.climate,
        type: "HUMIDITY_HIGH",
        status: "RESOLVED",
        message: "Humidade alta (79 %)",
        triggeredAt: humidStart,
        resolvedAt: humidEnd,
      },
      {
        siteId: DEMO.siteId,
        deviceId: DEMO.devices.door,
        type: "DOOR_OPEN",
        status: "RESOLVED",
        message: "Porta ou janela aberta",
        triggeredAt: doorStart,
        resolvedAt: doorEnd,
      },
      {
        siteId: DEMO.siteId,
        deviceId: DEMO.devices.motion,
        type: "MOTION",
        status: "RESOLVED",
        message: "Movimento detectado (42 lx)",
        triggeredAt: moveStart,
        resolvedAt: moveEnd,
      },
    ],
  });

  await prisma.careReport.upsert({
    where: { id: DEMO.reportId },
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
      id: DEMO.reportId,
      propertyId: DEMO.propertyId,
      visitedAt: hoursAgo(now, 26),
      visitedByName: "Gonçalo",
      verdict: "OK",
      summary: "Casa arejada, sem cheiros. Recolhemos o correio e confirmámos portas e água.",
      nextVisitAt: hoursAgo(now, -80),
      status: "PUBLISHED",
      publishedAt: hoursAgo(now, 25),
    },
  });
  await prisma.careReportItem.deleteMany({ where: { reportId: DEMO.reportId } });
  await prisma.careReportItem.createMany({
    data: [
      { reportId: DEMO.reportId, key: "DOORS", status: "DONE", note: "Fechadas e trancadas.", sortOrder: 0 },
      { reportId: DEMO.reportId, key: "WINDOWS", status: "DONE", note: "Arejámos 20 minutos.", sortOrder: 1 },
      { reportId: DEMO.reportId, key: "MAIL", status: "DONE", note: "Correspondência na gaveta da cozinha.", sortOrder: 2 },
      { reportId: DEMO.reportId, key: "AIR", status: "DONE", note: null, sortOrder: 3 },
      { reportId: DEMO.reportId, key: "WATER", status: "DONE", note: "Sem fugas.", sortOrder: 4 },
      { reportId: DEMO.reportId, key: "LIGHTS", status: "DONE", note: null, sortOrder: 5 },
      { reportId: DEMO.reportId, key: "WASTE", status: "SKIPPED", note: null, sortOrder: 6 },
      { reportId: DEMO.reportId, key: "EXTERIOR", status: "DONE", note: "Pátio em ordem.", sortOrder: 7 },
    ],
  });

  console.log(`Casa demo: ${ownerEmail} · Ericeira · OTP em /casa/entrar`);
}

async function upsertDemoDevice(data: {
  id: string;
  kind: "GATEWAY" | "DOOR" | "TEMP_HUMIDITY" | "WATER" | "MOTION";
  label: string;
  model: string;
  online: boolean;
  lastSeenAt: Date;
  batteryPct: number | null;
  lastPayload: object;
}) {
  await prisma.pulseDevice.upsert({
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
      siteId: DEMO.siteId,
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
    const leaking = between(recordedAt, events.leakStart, events.leakEnd);
    const humid = between(recordedAt, events.humidStart, events.humidEnd);
    const open = between(recordedAt, events.doorStart, events.doorEnd);
    const moving = between(recordedAt, events.moveStart, events.moveEnd);

    rows.push({
      deviceId: DEMO.devices.climate,
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
      deviceId: DEMO.devices.door,
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
      deviceId: DEMO.devices.water,
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
      deviceId: DEMO.devices.motion,
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

function twoMinutesAgo(now: Date) {
  return new Date(now.getTime() - 2 * 60_000);
}

function between(at: Date, start: Date, end: Date) {
  return at >= start && at <= end;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
