import webpush from "web-push";
import type { CasaPushPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listSiteOwnerUserIds } from "@/lib/casa";
import { loadCasaNotifyPrefs, selectCasaPushAlerts } from "@/lib/casa-notify";
import { apnsConfig, sendApnsAlert, type CasaPushPayload } from "@/lib/apns";
import { pulseAlertWork } from "@/lib/pulse-alerts";
import { vapidConfig } from "@/lib/vapid";
import type { OpenedPulseAlert } from "@/lib/pulse";

type CasaPushDeviceRow = {
  id: string;
  platform: CasaPushPlatform;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  apnsToken: string | null;
};

export async function notifyOpenedPulseAlerts(
  siteId: string,
  deviceLabel: string,
  opened: OpenedPulseAlert[],
) {
  const prefs = await loadCasaNotifyPrefs(siteId);
  const alerts = selectCasaPushAlerts(opened, prefs);
  if (alerts.length === 0) return;

  const ownerIds = await listSiteOwnerUserIds(siteId);
  if (ownerIds.length === 0) return;

  const devices = await prisma.casaPushDevice.findMany({
    where: { userId: { in: ownerIds } },
  });
  if (devices.length === 0) return;

  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    select: { property: { select: { address: true, city: true } } },
  });
  if (!site) return;

  const primary = alerts.sort((left, right) => urgency(left.type) - urgency(right.type))[0];
  const work = pulseAlertWork(primary.type);
  const address = [site.property.address, site.property.city].filter(Boolean).join(" · ");
  const payload: CasaPushPayload = {
    title: `Laro Pulse · ${work.why}`,
    body: `${deviceLabel} · ${address}`,
    siteId,
    type: primary.type,
    url: `/casa/${siteId}`,
  };

  await Promise.all([sendWebPushes(devices, payload), sendApnsPushes(devices, payload)]);
}

function urgency(type: OpenedPulseAlert["type"]) {
  if (type === "WATER_LEAK") return 0;
  if (type === "OFFLINE") return 1;
  if (type === "MOTION") return 2;
  return 3;
}

async function sendWebPushes(devices: CasaPushDeviceRow[], payload: CasaPushPayload) {
  const vapid = vapidConfig();
  const subscriptions = devices.filter(
    (device): device is CasaPushDeviceRow & { endpoint: string; p256dh: string; auth: string } =>
      device.platform === "WEB" && Boolean(device.endpoint && device.p256dh && device.auth),
  );
  if (!vapid || subscriptions.length === 0) return;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
      } catch (error) {
        const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (status === 404 || status === 410) {
          await prisma.casaPushDevice.deleteMany({ where: { id: subscription.id } });
        }
      }
    }),
  );
}

async function sendApnsPushes(devices: CasaPushDeviceRow[], payload: CasaPushPayload) {
  const config = apnsConfig();
  const tokens = devices.filter(
    (device): device is CasaPushDeviceRow & { apnsToken: string } =>
      device.platform === "IOS" && Boolean(device.apnsToken),
  );
  if (!config || tokens.length === 0) return;

  await Promise.all(
    tokens.map(async (device) => {
      try {
        const result = await sendApnsAlert(config, device.apnsToken, payload);
        if (!result.ok && result.dead) {
          await prisma.casaPushDevice.deleteMany({ where: { id: device.id } });
        }
      } catch {
        // keep the token; Apple may be unreachable
      }
    }),
  );
}
