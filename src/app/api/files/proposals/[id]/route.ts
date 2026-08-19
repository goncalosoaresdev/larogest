import { NextResponse } from "next/server";
import { jsonError, limited, pdfContentDisposition, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sectionsFromSnapshot } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = limited(request, "files", 60);
  if (blocked) return blocked;
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { lead: { include: { person: true } } },
    });
    if (!proposal) return jsonError(404, "PDF indisponível");

    const pdf = await renderDocumentPdf({
      kind: "Proposta",
      reference: proposal.reference,
      subtitle: proposal.lead.person.name,
      sections: sectionsFromSnapshot(proposal.snapshot),
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": pdfContentDisposition(proposal.reference),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "PDF indisponível");
  }
}
