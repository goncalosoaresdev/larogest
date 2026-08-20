import { NextResponse } from "next/server";
import { jsonError, limited, pdfContentDisposition, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sectionsFromSnapshot } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf";
import { readPdf } from "@/lib/storage";

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
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { proposal: { include: { lead: { include: { person: true } } } } },
    });
    if (!contract) return jsonError(404, "not_found");

    const body = contract.signedPdfPath
      ? await readPdf(contract.signedPdfPath)
      : await renderDocumentPdf({
          kind: "Contrato",
          reference: contract.reference,
          subtitle: contract.proposal.lead.person.name,
          sections: sectionsFromSnapshot(contract.snapshot),
        });

    return new NextResponse(Uint8Array.from(body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": pdfContentDisposition(contract.reference),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
