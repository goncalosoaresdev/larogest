import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { visitKindLabel, visitStatusLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { completeVisit, cancelVisit } from "@/app/(app)/visitas/actions";
import { Button } from "@/components/ui/button";

type VisitRow = {
  id: string;
  leadId: string;
  scheduledAt: Date;
  kind: keyof typeof visitKindLabel;
  status: keyof typeof visitStatusLabel;
  lead: {
    person: { name: string };
    property: { city: string | null; address: string } | null;
  };
};

export default async function VisitasPage() {
  const now = new Date();
  const visits = await prisma.visit.findMany({
    include: { lead: { include: { person: true, property: true } } },
    orderBy: { scheduledAt: "asc" },
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
      />

      {overdue.length ? <VisitTable title="Atrasadas" visits={overdue} actions /> : null}

      <VisitTable
        title="Próximas"
        empty="Não há visitas agendadas. Abre uma lead e marca a primeira."
        visits={upcoming}
        actions
      />

      {past.length ? <VisitTable title="Histórico" visits={past} /> : null}
    </div>
  );
}

function VisitTable({
  title,
  empty,
  visits,
  actions,
}: {
  title: string;
  empty?: string;
  visits: VisitRow[];
  actions?: boolean;
}) {
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
                {actions ? <TableHead className="w-[1%] text-right"> </TableHead> : null}
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
                    {actions ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
