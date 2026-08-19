import "dotenv/config";
import { PrismaClient, type PulseDevice } from "@prisma/client";
import {
  applyPulseReading,
  autoLinkUnlinkedSites,
  fillMissingLocationNames,
  isPulseSiteActive,
  PULSE_SITE_DISABLED,
  syncPulseDevices,
} from "../src/lib/pulse";
import { notifyOpenedPulseAlerts } from "../src/lib/pulse-notify";
import { getIoTAdapter, listIoTAdapters, type IoTAdapter, type ProviderEvent } from "../src/lib/iot";

const RECONCILE_MS = 30 * 60_000;
const INVENTORY_DEBOUNCE_MS = 15_000;
const prisma = new PrismaClient();

const usage = {
  apiCalls: 0,
  messages: 0,
  applied: 0,
  startedAt: Date.now(),
};

function logUsage(reason: string) {
  const hours = Math.max(1 / 60, (Date.now() - usage.startedAt) / 3_600_000);
  console.log(
    `Quota ${reason}: ${usage.apiCalls} API · ${usage.messages} mensagens · ${usage.applied} leituras · ~${Math.round(usage.apiCalls / hours)} API/h`,
  );
}

async function linkUnlinkedHomes() {
  const linked = await autoLinkUnlinkedSites();
  for (const match of linked) {
    console.log(`Casa ligada automaticamente: ${match.name} (${match.id})`);
  }
}

async function reconcileHomes(reason: string, siteId?: string) {
  if (!siteId) {
    await linkUnlinkedHomes();
    await fillMissingLocationNames();
  }

  const sites = await prisma.pulseSite.findMany({
    where: {
      locationId: { not: null },
      status: { not: PULSE_SITE_DISABLED },
      ...(siteId ? { id: siteId } : {}),
    },
  });

  if (sites.length === 0) {
    console.log("Nenhuma casa ligada no Pulse. Guarda o ID da localização na ficha do imóvel.");
    return;
  }

  for (const site of sites) {
    if (!site.locationId) continue;
    const adapter = getIoTAdapter(site.provider);
    usage.apiCalls += 1;
    const remote = await adapter.listDevices(site.locationId);
    await prisma.$transaction((tx) => syncPulseDevices(tx, site.id, remote));
    console.log(`${adapter.meta.label} ${site.locationId}: ${remote.length} dispositivo(s) [${reason}]`);
  }
  logUsage(reason);
}

async function adoptUnknownDevice(adapter: IoTAdapter, deviceId: string) {
  if (!adapter.getDevice) return null;
  usage.apiCalls += 1;
  const remote = await adapter.getDevice(deviceId);
  if (!remote?.locationId) return null;

  const site = await prisma.pulseSite.findFirst({
    where: {
      provider: adapter.meta.id,
      locationId: remote.locationId,
      status: { not: PULSE_SITE_DISABLED },
    },
  });
  if (!site) return null;

  await prisma.$transaction((tx) => syncPulseDevices(tx, site.id, [remote]));
  return prisma.pulseDevice.findUnique({ where: { providerDeviceId: deviceId } });
}

async function applyDeviceEvent(device: PulseDevice, event: ProviderEvent) {
  const hasReading = Object.keys(event.reading).length > 0 || event.batteryPct != null;
  if (event.online == null && !hasReading) return;

  const opened = await prisma.$transaction((tx) =>
    applyPulseReading(tx, device, {
      online: event.online ?? device.online,
      batteryPct: event.batteryPct ?? device.batteryPct,
      reading: event.reading,
    }),
  );
  if (opened.length) {
    void notifyOpenedPulseAlerts(device.siteId, device.label, opened).catch((error) => console.error(error));
  }
  usage.applied += 1;
  const bits = [
    event.reason,
    event.reading.leak === true ? "fuga" : event.reading.leak === false ? "seco" : null,
    event.reading.open === true ? "aberta" : event.reading.open === false ? "fechada" : null,
    event.reading.motion === true ? "movimento" : event.reading.motion === false ? "calmo" : null,
    event.reading.lux != null ? `${Math.round(event.reading.lux)} lx` : null,
    event.reading.temperature != null ? `${event.reading.temperature}°C` : null,
    event.reading.humidity != null ? `${event.reading.humidity}%` : null,
    event.online === false ? "offline" : event.online === true ? "online" : null,
  ].filter(Boolean);
  console.log(`${device.label}: ${bits.join(" · ") || "estado"}`);
}

function startWatchers(scheduleInventory: (reason: string, siteId?: string) => void) {
  return listIoTAdapters().flatMap((adapter) => {
    if (!adapter.watch) return [];

    const watch = adapter.watch({
      onOpen: () => {
        console.log(`${adapter.meta.label}: push ligado. Fugas e portas chegam em tempo real.`);
      },
      onClose: (code, reason) => {
        console.warn(`${adapter.meta.label}: push fechou (${code}) ${reason}`);
      },
      onError: (error) => {
        console.error(`${adapter.meta.label}:`, error.message);
      },
      onEvent: (event) => {
        void (async () => {
          usage.messages += 1;
          if (event.inventoryChanged) {
            console.log(`Inventário ${adapter.meta.label} mudou (${event.reason ?? "bind"}): ${event.deviceId}`);
          }

          const known = await prisma.pulseDevice.findUnique({
            where: { providerDeviceId: event.deviceId },
            include: { site: true },
          });
          if (known && !isPulseSiteActive(known.site.status)) return;

          const adopted = known ? null : await adoptUnknownDevice(adapter, event.deviceId);
          if (adopted) {
            console.log(`${adapter.meta.label}: ${adopted.label} ligado automaticamente`);
          }
          const device = known ?? adopted;
          if (!device) {
            scheduleInventory(event.inventoryChanged ? "inventário" : "dispositivo novo");
            return;
          }
          if (event.inventoryChanged) scheduleInventory("inventário", device.siteId);
          const emptyReading = Object.keys(event.reading).length === 0 && event.batteryPct == null;
          if (device.kind === "GATEWAY" && event.online == null && emptyReading) return;
          await applyDeviceEvent(device, event);
        })().catch((error) => console.error(error));
      },
    });

    if (adapter.describe) {
      console.log(`${adapter.meta.label}: ${adapter.describe()}`);
    }
    watch.start();
    return [watch];
  });
}

async function main() {
  console.log("Pulse: push em tempo real + reconciliação lenta. Ctrl+C para parar.");

  await reconcileHomes("arranque");

  let inventoryTimer: ReturnType<typeof setTimeout> | null = null;
  let inventoryTarget: "all" | string | undefined;
  const scheduleInventory = (reason: string, siteId?: string) => {
    if (inventoryTimer) clearTimeout(inventoryTimer);
    if (!siteId || inventoryTarget === "all") inventoryTarget = "all";
    else if (inventoryTarget && inventoryTarget !== siteId) inventoryTarget = "all";
    else inventoryTarget = siteId;
    inventoryTimer = setTimeout(() => {
      const target = inventoryTarget === "all" ? undefined : inventoryTarget;
      inventoryTarget = undefined;
      void reconcileHomes(reason, target).catch((error) => console.error(error));
    }, INVENTORY_DEBOUNCE_MS);
  };

  const watchers = startWatchers(scheduleInventory);

  setInterval(() => {
    void reconcileHomes("segurança").catch((error) => console.error(error));
  }, RECONCILE_MS);

  const shutdown = async () => {
    for (const watch of watchers) watch.stop();
    logUsage("saída");
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
