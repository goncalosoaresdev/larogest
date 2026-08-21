import { prisma } from "@/lib/prisma";
import { CARE_CHECKLIST_KEYS, canLinkVisitToCareReport, type CareChecklistStatus } from "@/lib/care-report";
import { formatDateTime } from "@/lib/format";
import { CareReportFields } from "@/components/care-report-fields";
import { Card, CardContent } from "@/components/ui/card";
import type { CareReport } from "@prisma/client";

function toDatetimeLocal(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export async function CareReportForm({
  report,
  visitId,
}: {
  report?: CareReport;
  visitId?: string;
}) {
  const pinnedIds = [report?.visitId, visitId].filter((id): id is string => Boolean(id));
  const [properties, recentVisits, pinnedVisits, items] = await Promise.all([
    prisma.property.findMany({
      include: { person: { select: { name: true } } },
      orderBy: [{ city: "asc" }, { address: "asc" }],
    }),
    prisma.visit.findMany({
      where: { status: { not: "CANCELLED" }, propertyId: { not: null } },
      include: { property: { select: { address: true, city: true } }, careReport: { select: { id: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 80,
    }),
    pinnedIds.length
      ? prisma.visit.findMany({
          where: { id: { in: pinnedIds } },
          include: { property: { select: { address: true, city: true } }, careReport: { select: { id: true } } },
        })
      : Promise.resolve([]),
    report
      ? prisma.careReportItem.findMany({
          where: { reportId: report.id },
          orderBy: { sortOrder: "asc" },
          select: {
            key: true,
            status: true,
            note: true,
            photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
          },
        })
      : Promise.resolve([]),
  ]);

  const visitsById = new Map<string, (typeof recentVisits)[number]>();
  for (const visit of [...pinnedVisits, ...recentVisits]) visitsById.set(visit.id, visit);
  const eligibleVisits = [...visitsById.values()].filter(
    (visit) =>
      visit.status !== "CANCELLED" &&
      canLinkVisitToCareReport(visit.kind) &&
      visit.propertyId &&
      (!visit.careReport || visit.careReport.id === report?.id),
  );
  const linkedVisit = eligibleVisits.find((visit) => visit.id === (report?.visitId ?? visitId));
  const defaultVisitId = linkedVisit?.id ?? "";
  const defaultPropertyId = report?.propertyId ?? linkedVisit?.propertyId ?? "";

  if (properties.length === 0) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Ainda não há imóveis. Abre uma lead e guarda a morada antes de escrever o relatório.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <CareReportFields
      properties={properties.map((property) => ({
        id: property.id,
        label: `${property.city ? `${property.city} · ` : ""}${property.address} (${property.person.name})`,
      }))}
      visits={eligibleVisits.map((visit) => ({
        id: visit.id,
        label: `${formatDateTime(visit.scheduledAt)}${visit.property?.city ? ` · ${visit.property.city}` : ""}${visit.property?.address ? ` · ${visit.property.address}` : ""}`,
      }))}
      values={{
        id: report?.id,
        propertyId: defaultPropertyId,
        visitId: defaultVisitId,
        visitedAt: toDatetimeLocal(report?.visitedAt ?? new Date()),
        visitedByName: report?.visitedByName ?? "",
        verdict: report?.verdict ?? "OK",
        summary: report?.summary ?? "",
        nextVisitAt: report?.nextVisitAt ? toDatetimeLocal(report.nextVisitAt) : "",
        status: report?.status,
        checklist: CARE_CHECKLIST_KEYS.map((key) => {
          const row = items.find((item) => item.key === key);
          return {
            key,
            status: (row?.status ?? "SKIPPED") as CareChecklistStatus,
            note: row?.note ?? "",
            photos: row?.photos ?? [],
          };
        }),
      }}
    />
  );
}
