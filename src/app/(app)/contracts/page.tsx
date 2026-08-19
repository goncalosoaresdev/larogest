import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { contractStatusLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default async function ContractsPage() {
  const contracts = await prisma.contract.findMany({
    include: { proposal: { include: { lead: { include: { person: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Os contratos nascem de propostas aceites. Não se reintroduzem números."
      />
      <Card className="py-0">
        {contracts.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Os contratos nascem de propostas aceites. Não se reintroduzem números.
          </p>
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
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>
                    <Link href={`/contracts/${contract.id}`} className="font-mono text-sm hover:text-primary">
                      {contract.reference}
                    </Link>
                  </TableCell>
                  <TableCell>{contract.proposal.lead.person.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(contract.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={contract.status}>{contractStatusLabel[contract.status]}</StatusBadge>
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
