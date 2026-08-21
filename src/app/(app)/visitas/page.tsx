import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canLinkVisitToCareReport } from "@/lib/care-report";
import { careReportStatusLabel, careReportVerdictLabel, visitKindLabel, visitStatusLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { completeVisit, cancelVisit } from "@/app/(app)/visitas/actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type VisitRow = {
  id: string;
  leadId: string;
  scheduledAt: Date;
  kind: keyof typeof visitKindLabel;
  status: keyof typeof visitStatusLabel;
  careReport: { id: string } | null;
  lead: {
    person: { name: string };
    property: { city: string | null; address: string } | null;
  };
};

export default async function VisitasPage() {
  const now = new Date();
  const visits = await prisma.visit.findMany({
    include: { lead: { include: { person: true, property: true } }, careReport: { select: { id: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  const reports = await prisma.careReport.findMany({
    include: { property: { select: { address: true, city: true, person: { select: { name: true } } } } },
    orderBy: { visitedAt: "desc" },
    take: 20,
  });
  const upcoming = visits.filter((visit) => visit.status === "SCHEDULED" && visit.scheduledAt >= now);
  const overdue = visits.filter((visit) => visit.status === "SCHEDULED" && visit.scheduledAt < now);
  const past = visits
    .filter((visit) => visit.status !== "SCHEDULED")
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitas"
        description="Agenda de visitas de conhecimento, property care e operação."
        action={
          <Link href="/visitas/relatorios/new" className={cn(buttonVariants())}>
            Novo relatório
          </Link>
        }
      />

      {overdue.length ? <VisitTable title="Atrasadas" visits={overdue} actions /> : null}

      <VisitTable
        title="Próximas"
        empty="Não há visitas agendadas. Abre uma lead e marca a primeira."
        visits={upcoming}
        actions
      />

      {past.length ? <VisitTable title="Histórico" visits={past} reports /> : null}

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Relatórios para o proprietário</h2>
        <Card className="py-0">
          {reports.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ainda não há relatórios. Depois de uma visita de property care ou operação, escreve a carta para a Casa.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Veredicto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(report.visitedAt)}</TableCell>
                    <TableCell>
                      <Link href={`/visitas/relatorios/${report.id}`} className="hover:underline">
                        {report.property.city ? `${report.property.city} · ` : ""}
                        {report.property.address}
                      </Link>
                      <span className="block text-muted-foreground text-xs">{report.property.person.name}</span>
                    </TableCell>
                    <TableCell>{careReportVerdictLabel[report.verdict]}</TableCell>
                    <TableCell>
                      <StatusBadge status={report.status}>{careReportStatusLabel[report.status]}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function VisitTable({
  title,
  empty,
  visits,
  actions,
  reports,
}: {
  title: string;
  empty?: string;
  visits: VisitRow[];
  actions?: boolean;
  reports?: boolean;
}) {
  const extra = actions || reports;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <Card className="py-0">
        {visits.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                {extra ? <TableHead className="w-[1%] text-right"> </TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((visit) => {
                const done = completeVisit.bind(null, visit.id);
                const cancel = cancelVisit.bind(null, visit.id);
                return (
                  <TableRow key={visit.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(visit.scheduledAt)}</TableCell>
                    <TableCell>
                      <Link href={`/leads/${visit.leadId}`} className="hover:underline">
                        {visit.lead.person.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {visit.lead.property?.city || visit.lead.property?.address || "—"}
                    </TableCell>
                    <TableCell>{visitKindLabel[visit.kind]}</TableCell>
                    <TableCell>
                      <StatusBadge status={visit.status}>{visitStatusLabel[visit.status]}</StatusBadge>
                    </TableCell>
                    {extra ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {actions ? (
                            <>
                              <form action={done}>
                                <Button type="submit" size="sm">
                                  Feita
                                </Button>
                              </form>
                              <form action={cancel}>
                                <Button type="submit" size="sm" variant="outline">
                                  Cancelar
                                </Button>
                              </form>
                            </>
                          ) : null}
                          {reports && canLinkVisitToCareReport(visit.kind) ? (
                            <Link
                              href={
                                visit.careReport
                                  ? `/visitas/relatorios/${visit.careReport.id}`
                                  : `/visitas/relatorios/new?visitId=${visit.id}`
                              }
                              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                            >
                              {visit.careReport ? "Relatório" : "Escrever relatório"}
                            </Link>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
