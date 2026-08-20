import webpush from "web-push";
import { prisma } from "../src/lib/prisma";
import { vapidConfig } from "../src/lib/vapid";

async function main() {
  const vapid = vapidConfig();
  if (!vapid) {
    console.error("VAPID is not configured");
    process.exit(1);
  }

  const devices = await prisma.casaPushDevice.findMany({
    where: { platform: "WEB", endpoint: { not: null } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const ready = devices.filter((device) => device.endpoint && device.p256dh && device.auth);
  const site = await prisma.pulseSite.findFirst({
    where: { status: { not: "DISABLED" } },
    select: { id: true, property: { select: { address: true, city: true } } },
  });

  if (ready.length === 0) {
    console.error("No web push subscriptions. Open /casa, enable Avisos, then retry.");
    process.exit(1);
  }

  const siteId = site?.id ?? "";
  const address = site ? [site.property.address, site.property.city].filter(Boolean).join(" · ") : "Casa";
  const payload = {
    title: "Laro Pulse · Teste",
    body: `Notificação de teste · ${address}`,
    siteId,
    type: "WATER_LEAK",
    url: siteId ? `/casa/${siteId}` : "/casa",
  };

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  let sent = 0;
  let gone = 0;
  let failed = 0;
  for (const device of ready) {
    try {
      await webpush.sendNotification(
        {
          endpoint: device.endpoint!,
          keys: { p256dh: device.p256dh!, auth: device.auth! },
        },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await prisma.casaPushDevice.deleteMany({ where: { id: device.id } });
        gone += 1;
      } else {
        failed += 1;
        const message = error instanceof Error ? error.message : "send failed";
        console.error(`web push failed (${status || "no-status"}): ${message}`);
      }
    }
  }

  console.log(`Tried ${ready.length} browser(s). Sent ${sent}. Gone ${gone}. Failed ${failed}.`);
  await prisma.$disconnect();
  if (sent === 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
