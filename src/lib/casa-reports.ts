import { prisma } from "@/lib/prisma";
import { isPulseSiteActive } from "@/lib/pulse";
import { ownerVisibleChecklist, type CareChecklistKey, type CareChecklistStatus } from "@/lib/care-report";

export type CasaCareReport = {
  id: string;
  visitedAt: string;
  visitedByName: string;
  verdict: "OK" | "ATTENTION" | "URGENT";
  summary: string;
  nextVisitAt: string | null;
  publishedAt: string;
  checklist: Array<{
    key: CareChecklistKey;
    status: Exclude<CareChecklistStatus, "SKIPPED">;
    note: string | null;
    photos: { id: string }[];
  }>;
};

export async function loadCasaReports(siteId: string): Promise<CasaCareReport[] | null> {
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    select: { status: true, propertyId: true },
  });
  if (!site || !isPulseSiteActive(site.status)) return null;

  const rows = await prisma.careReport.findMany({
    where: { propertyId: site.propertyId, status: "PUBLISHED" },
    orderBy: { visitedAt: "desc" },
    take: 50,
    select: {
      id: true,
      visitedAt: true,
      visitedByName: true,
      verdict: true,
      summary: true,
      nextVisitAt: true,
      publishedAt: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          key: true,
          status: true,
          note: true,
          photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    visitedAt: row.visitedAt.toISOString(),
    visitedByName: row.visitedByName,
    verdict: row.verdict,
    summary: row.summary,
    nextVisitAt: row.nextVisitAt?.toISOString() ?? null,
    publishedAt: (row.publishedAt ?? row.visitedAt).toISOString(),
    checklist: ownerVisibleChecklist(row.items).map((item) => ({
      key: item.key as CareChecklistKey,
      status: item.status as Exclude<CareChecklistStatus, "SKIPPED">,
      note: item.note,
      photos: item.photos,
    })),
  }));
}
