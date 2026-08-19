import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sectionsFromSnapshot } from "@/lib/documents";
import { markProposalViewed } from "@/app/(app)/proposals/actions";
import { DocumentPreview } from "@/components/document-preview";
import { PublicProposalActions } from "@/components/public-proposal-actions";
import { formatDateLong } from "@/lib/format";

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: token },
    include: { lead: { include: { person: true } } },
  });
  if (!proposal) notFound();
  await markProposalViewed(token);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted-foreground">Laro · Proposta</p>
      <h1 className="text-2xl font-semibold tracking-tight">{proposal.reference}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Preparada para {proposal.lead.person.name} · válida até {formatDateLong(proposal.validUntil)}
      </p>
      <DocumentPreview sections={sectionsFromSnapshot(proposal.snapshot)} />
      <div className="mt-8">
        <PublicProposalActions
          token={token}
          status={proposal.status}
          expired={proposal.validUntil < new Date()}
        />
      </div>
    </div>
  );
}
