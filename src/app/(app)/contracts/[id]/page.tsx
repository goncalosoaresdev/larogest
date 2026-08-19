import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { contractStatusLabel, signerRoleLabel } from "@/lib/labels";
import { formatDateLong } from "@/lib/format";
import { sectionsFromSnapshot } from "@/lib/documents";
import { sendContract, signAsCompany } from "@/app/(app)/contracts/actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SendLinkButton } from "@/components/send-link-button";
import { DocumentPreview } from "@/components/document-preview";
import { cn } from "@/lib/utils";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  );
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      signatures: true,
      proposal: { include: { lead: { include: { person: true } } } },
    },
  });
  if (!contract) notFound();
  const sections = sectionsFromSnapshot(contract.snapshot);
  const send = sendContract.bind(null, contract.id);
  const signCompany = signAsCompany.bind(null, contract.id);
  const companySig = contract.signatures.find((item) => item.role === "COMPANY");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{contract.reference}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contract.proposal.lead.person.name}
            </h1>
            <StatusBadge status={contract.status}>{contractStatusLabel[contract.status]}</StatusBadge>
          </div>
        </div>
        <Link
          href={`/proposals/${contract.proposalId}`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Ver proposta
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <DocumentPreview title="Contrato" sections={sections} />

        <aside className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <SummaryRow label="Início" value={formatDateLong(contract.startsOn)} />
              <SummaryRow label="Fim" value={formatDateLong(contract.endsOn)} />
              <SummaryRow label="Pré-aviso" value={`${contract.noticeDays} dias`} />
              <SummaryRow label="Proposta" value={contract.proposal.reference} />
              {contract.documentHash ? (
                <SummaryRow label="SHA-256" value={contract.documentHash} />
              ) : null}
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2">
              <SendLinkButton
                className="w-full"
                label="Enviar ao proprietário"
                sentLabel="Enviado."
                action={send}
              />
              <a
                href={`/api/files/contracts/${contract.id}`}
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                Descarregar PDF
              </a>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Assinaturas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {contract.signatures.map((signature) => (
                <p key={signature.id} className="text-sm">
                  {signerRoleLabel[signature.role]}:{" "}
                  {signature.signedAt ? `assinado ${formatDateLong(signature.signedAt)}` : "pendente"}
                </p>
              ))}
            </CardContent>
            {!companySig?.signedAt ? (
              <CardFooter>
                <form action={signCompany} className="w-full">
                  <Button type="submit" variant="outline" className="w-full">
                    Assinar como Laro
                  </Button>
                </form>
              </CardFooter>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
