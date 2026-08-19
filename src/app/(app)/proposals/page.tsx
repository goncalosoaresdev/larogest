import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { proposalStatusLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default async function ProposalsPage() {
  const proposals = await prisma.proposal.findMany({
    include: { lead: { include: { person: true } }, property: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Propostas" description="Propostas enviadas às leads. Abre uma lead para gerar uma nova." />
      <Card className="py-0">
        {proposals.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Ainda não há propostas. Abre uma lead e gera a primeira.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell>
                    <Link href={`/proposals/${proposal.id}`} className="font-mono text-sm hover:text-primary">
                      {proposal.reference}
                    </Link>
                  </TableCell>
                  <TableCell>{proposal.lead.person.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(proposal.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={proposal.status}>{proposalStatusLabel[proposal.status]}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
