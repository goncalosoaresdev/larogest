import { prisma } from "@/lib/prisma";
import { isPulseSiteActive } from "@/lib/pulse";

export const CASA_HISTORY_PAGE = 36;

export type CasaHistorySample = {
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

export type CasaHistoryCursor = {
  recordedAt: string;
  id: string;
};

export type CasaHistoryPage = {
  samples: CasaHistorySample[];
  nextCursor: CasaHistoryCursor | null;
};

export async function loadCasaHistoryPage(
  siteId: string,
  input: {
    cursor?: CasaHistoryCursor | null;
    deviceId?: string | null;
    limit?: number;
  } = {},
): Promise<CasaHistoryPage | null> {
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    select: { status: true, devices: { select: { id: true } } },
  });
  if (!site || !isPulseSiteActive(site.status)) return null;

  const allowed = site.devices.map((device) => device.id);
  const deviceIds = input.deviceId
    ? allowed.includes(input.deviceId)
      ? [input.deviceId]
      : []
    : allowed;
  if (deviceIds.length === 0) return { samples: [], nextCursor: null };

  const limit = Math.min(Math.max(input.limit ?? CASA_HISTORY_PAGE, 12), 60);
  const cursorAt = input.cursor ? new Date(input.cursor.recordedAt) : null;
  const cursorId = input.cursor?.id;
  if (cursorAt && Number.isNaN(cursorAt.getTime())) return { samples: [], nextCursor: null };

  const rows = await prisma.pulseSample.findMany({
    where: {
      deviceId: { in: deviceIds },
      ...(cursorAt && cursorId
        ? {
            OR: [
              { recordedAt: { lt: cursorAt } },
              { recordedAt: cursorAt, id: { lt: cursorId } },
            ],
          }
        : {}),
    },
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      deviceId: true,
      recordedAt: true,
      temperature: true,
      humidity: true,
      leak: true,
      open: true,
      motion: true,
      lux: true,
      batteryPct: true,
      online: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    samples: page.map((sample) => ({
      ...sample,
      recordedAt: sample.recordedAt.toISOString(),
    })),
    nextCursor: hasMore && last ? { recordedAt: last.recordedAt.toISOString(), id: last.id } : null,
  };
}
