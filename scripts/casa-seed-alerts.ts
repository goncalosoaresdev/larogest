import { prisma } from "../src/lib/prisma";

async function main() {
  const site = await prisma.pulseSite.findFirst({
    where: {
      status: { not: "DISABLED" },
      property: { address: { contains: "110", mode: "insensitive" } },
    },
    include: {
      property: { select: { address: true, city: true } },
      devices: { select: { id: true, kind: true, label: true } },
    },
  });
  const fallback = site
    ?? (await prisma.pulseSite.findFirst({
      where: { status: { not: "DISABLED" } },
      include: {
        property: { select: { address: true, city: true } },
        devices: { select: { id: true, kind: true, label: true } },
      },
    }));
  if (!fallback) {
    console.error("No Pulse site to attach alerts to.");
    process.exit(1);
  }

  const water = fallback.devices.find((device) => device.kind === "WATER") ?? fallback.devices[0];
  const motion = fallback.devices.find((device) => device.kind === "MOTION");
  const climate = fallback.devices.find((device) => device.kind === "TEMP_HUMIDITY");
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60_000);

  await prisma.pulseAlert.createMany({
    data: [
      {
        siteId: fallback.id,
        deviceId: water?.id ?? null,
        type: "WATER_LEAK",
        status: "OPEN",
        message: "Fuga de água detectada",
        triggeredAt: now,
      },
      {
        siteId: fallback.id,
        deviceId: motion?.id ?? water?.id ?? null,
        type: "MOTION",
        status: "ACKED",
        message: "Movimento detectado",
        triggeredAt: hourAgo,
      },
      {
        siteId: fallback.id,
        deviceId: climate?.id ?? water?.id ?? null,
        type: "BATTERY",
        status: "RESOLVED",
        message: "Bateria a 12 %",
        triggeredAt: threeHoursAgo,
        resolvedAt: hourAgo,
      },
    ],
  });

  console.log(`Seeded 3 alerts on ${fallback.property.address} (${fallback.id}). Refresh the Alertas tab.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
