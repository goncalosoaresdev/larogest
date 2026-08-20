import webpush from "web-push";
import type { PulseAlertType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isCasaQuietHour, loadCasaNotifyPrefs } from "@/lib/casa-notify";
import { pulseAlertWork } from "@/lib/pulse-alerts";
import { vapidConfig } from "@/lib/vapid";
import type { OpenedPulseAlert } from "@/lib/pulse";

const PUSH_TYPES = new Set<PulseAlertType>([
  "WATER_LEAK",
  "MOTION",
  "OFFLINE",
  "BATTERY",
  "TEMP_HIGH",
  "TEMP_LOW",
  "HUMIDITY_HIGH",
]);

const QUIET_BYPASS = new Set<PulseAlertType>(["WATER_LEAK", "MOTION"]);

export async function notifyOpenedPulseAlerts(
  siteId: string,
  deviceLabel: string,
  opened: OpenedPulseAlert[],
) {
  let alerts = opened.filter((item) => PUSH_TYPES.has(item.type));
  if (alerts.length === 0) return;

  const prefs = await loadCasaNotifyPrefs(siteId);
  if (!prefs.push) return;
  if (isCasaQuietHour(prefs)) {
    alerts = alerts.filter((item) => QUIET_BYPASS.has(item.type));
  }
  if (alerts.length === 0) return;

  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    include: {
      property: { select: { address: true, city: true } },
      pushSubscriptions: true,
    },
  });
  if (!site) return;

  const primary = alerts.sort((left, right) => urgency(left.type) - urgency(right.type))[0];
  const work = pulseAlertWork(primary.type);
  const address = [site.property.address, site.property.city].filter(Boolean).join(" · ");
  const title = `Laro Pulse · ${work.why}`;
  const body = `${deviceLabel} · ${address}`;
  const url = `/casa/${siteId}`;

  await sendWebPushes(site.pushSubscriptions, { title, body, url });
}

function urgency(type: PulseAlertType) {
  if (type === "WATER_LEAK") return 0;
  if (type === "OFFLINE") return 1;
  if (type === "MOTION") return 2;
  return 3;
}

async function sendWebPushes(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: { title: string; body: string; url: string },
) {
  const vapid = vapidConfig();
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
          await prisma.pulsePushSubscription.deleteMany({ where: { id: subscription.id } });
        }
      }
    }),
  );
}
