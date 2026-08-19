import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sectionsFromSnapshot } from "@/lib/documents";
import { DocumentPreview } from "@/components/document-preview";
import { PublicContractSign } from "@/components/public-contract-sign";
import { contractStatusLabel } from "@/lib/labels";

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { publicToken: token },
    include: {
      signatures: true,
      proposal: { include: { lead: { include: { person: true } } } },
    },
  });
  if (!contract) notFound();
  const ownerSig = contract.signatures.find((item) => item.role === "OWNER");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted-foreground">Laro · Contrato</p>
      <h1 className="text-2xl font-semibold tracking-tight">{contract.reference}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {contract.proposal.lead.person.name} · {contractStatusLabel[contract.status]}
      </p>
      <DocumentPreview sections={sectionsFromSnapshot(contract.snapshot)} />
      <div className="mt-8">
        <PublicContractSign
          token={token}
          alreadySigned={Boolean(ownerSig?.signedAt)}
          locked={contract.status === "CANCELLED"}
        />
      </div>
      {contract.documentHash ? (
        <p className="mt-4 break-all font-mono text-[10px] text-muted-foreground">
          SHA-256 {contract.documentHash}
        </p>
      ) : null}
    </div>
  );
}
