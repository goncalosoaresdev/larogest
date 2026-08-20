import { prisma } from "@/lib/prisma";
import { DEFAULT_CASA_NOTIFY, type CasaNotifyPrefs } from "@/lib/casa-notify-types";

export {
  DEFAULT_CASA_NOTIFY,
  allowCasaNotify,
  isCasaQuietHour,
  parseClockMinutes,
  selectCasaPushAlerts,
  type CasaNotifyPrefs,
} from "@/lib/casa-notify-types";

export async function loadCasaNotifyPrefs(siteId: string): Promise<CasaNotifyPrefs> {
  const row = await prisma.pulseNotifySettings.findUnique({ where: { siteId } });
  if (!row) return { ...DEFAULT_CASA_NOTIFY };
  return {
    push: row.push,
    water: row.water,
    offline: row.offline,
    battery: row.battery,
    climate: row.climate,
    quietEnabled: row.quietEnabled,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  };
}

export async function saveCasaNotifyPrefs(siteId: string, patch: Partial<CasaNotifyPrefs>) {
  const current = await loadCasaNotifyPrefs(siteId);
  const next = { ...current, ...patch };
  await prisma.pulseNotifySettings.upsert({
    where: { siteId },
    create: { siteId, ...next },
    update: next,
  });
  return next;
}
