import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { commissionBaseLabel, packageLabel, proposalStatusLabel } from "@/lib/labels";
import { formatDateLong, formatPercent, toNumber } from "@/lib/format";
import { sectionsFromSnapshot } from "@/lib/documents";
import { createContractFromProposal } from "@/app/(app)/contracts/actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { DocumentPreview } from "@/components/document-preview";
import { cn } from "@/lib/utils";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{value}</span>
    </div>
  );
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { lead: { include: { person: true } }, property: true, contract: true },
  });
  if (!proposal) notFound();
  const sections = sectionsFromSnapshot(proposal.snapshot);
  const address = [proposal.property.address, proposal.property.city].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {proposal.reference} · v{proposal.templateVersion}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{proposal.lead.person.name}</h1>
            <StatusBadge status={proposal.status}>{proposalStatusLabel[proposal.status]}</StatusBadge>
          </div>
        </div>
        <Link href={`/leads/${proposal.leadId}`} className={cn(buttonVariants({ variant: "outline" }))}>
          Voltar à lead
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <DocumentPreview title="Proposta" sections={sections} />

        <aside className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <SummaryRow label="Pacote" value={packageLabel[proposal.package]} />
              <SummaryRow
                label="Comissão"
                value={`${formatPercent(toNumber(proposal.commissionPct))} sobre ${commissionBaseLabel[proposal.commissionBase]}`}
              />
              <SummaryRow label="Validade" value={formatDateLong(proposal.validUntil)} />
              <SummaryRow label="Imóvel" value={address} />
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2">
              {proposal.pdfPath ? (
                <a
                  href={`/api/files/proposals/${proposal.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Descarregar PDF
                </a>
              ) : null}
              {proposal.contract ? (
                <Link
                  href={`/contracts/${proposal.contract.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Abrir contrato {proposal.contract.reference}
                </Link>
              ) : null}
            </CardFooter>
          </Card>

          {proposal.status === "ACCEPTED" && !proposal.contract ? (
            <form action={createContractFromProposal}>
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Contrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  <input type="hidden" name="proposalId" value={proposal.id} />
                  <FormField label="Início">
                    <Input name="startsOn" type="date" required />
                  </FormField>
                  <FormField label="Duração (meses)">
                    <Input name="months" type="number" defaultValue="12" />
                  </FormField>
                  <FormField label="Pré-aviso (dias)">
                    <Input name="noticeDays" type="number" defaultValue="30" />
                  </FormField>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">
                    Gerar contrato
                  </Button>
                </CardFooter>
              </Card>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
