import type { CasaOwnerAlert } from "@/lib/casa";
import { prisma } from "@/lib/prisma";
import { isPulseSiteActive } from "@/lib/pulse";

export const CASA_ALERT_HISTORY_DAYS = 30;
export const CASA_ALERT_HISTORY_PAGE = 24;

export type CasaAlertHistoryCursor = {
  triggeredAt: string;
  id: string;
};

export type CasaAlertHistoryPage = {
  alerts: CasaOwnerAlert[];
  nextCursor: CasaAlertHistoryCursor | null;
};

export function casaAlertHistorySince(now: Date, days = CASA_ALERT_HISTORY_DAYS) {
  return new Date(now.getTime() - days * 86_400_000);
}

export function parseCasaAlertHistoryCursor(at: string | null, id: string | null): CasaAlertHistoryCursor | null {
  if (!at || !id) return null;
  const triggeredAt = new Date(at);
  if (Number.isNaN(triggeredAt.getTime())) return null;
  return { triggeredAt: triggeredAt.toISOString(), id };
}

export function isCasaInboxAlert(alert: Pick<CasaOwnerAlert, "status">) {
  return alert.status === "OPEN" || alert.status === "ACKED";
}

export function mergeCasaPastAlerts(liveResolved: CasaOwnerAlert[], fetched: CasaOwnerAlert[]) {
  const seen = new Set<string>();
  const merged: CasaOwnerAlert[] = [];
  for (const item of [...liveResolved, ...fetched]) {
    if (item.status !== "RESOLVED" || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.sort((left, right) => {
    if (left.triggeredAt === right.triggeredAt) return right.id.localeCompare(left.id);
    return left.triggeredAt < right.triggeredAt ? 1 : -1;
  });
}

export async function loadCasaAlertHistoryPage(
  siteId: string,
  input: {
    cursor?: CasaAlertHistoryCursor | null;
    limit?: number;
    now?: Date;
  } = {},
): Promise<CasaAlertHistoryPage | null> {
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    select: { status: true },
  });
  if (!site || !isPulseSiteActive(site.status)) return null;

  const limit = Math.min(Math.max(input.limit ?? CASA_ALERT_HISTORY_PAGE, 12), 60);
  const since = casaAlertHistorySince(input.now ?? new Date());
  const cursorAt = input.cursor ? new Date(input.cursor.triggeredAt) : null;
  const cursorId = input.cursor?.id;
  if (cursorAt && Number.isNaN(cursorAt.getTime())) return { alerts: [], nextCursor: null };

  const rows = await prisma.pulseAlert.findMany({
    where: {
      siteId,
      status: "RESOLVED",
      triggeredAt: { gte: since },
      ...(cursorAt && cursorId
        ? {
            OR: [
              { triggeredAt: { lt: cursorAt } },
              { triggeredAt: cursorAt, id: { lt: cursorId } },
            ],
          }
        : {}),
    },
    orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      type: true,
      status: true,
      message: true,
      triggeredAt: true,
      deviceId: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    alerts: page.map((alert) => ({
      ...alert,
      triggeredAt: alert.triggeredAt.toISOString(),
    })),
    nextCursor: hasMore && last ? { triggeredAt: last.triggeredAt.toISOString(), id: last.id } : null,
  };
}
