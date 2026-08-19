import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { defaultProposalSections } from "../src/lib/default-templates";
import { buildMergeContext, snapshotDocument } from "../src/lib/documents";
import { renderDocumentPdf } from "../src/lib/pdf";

async function main() {
  const company = await prisma.companySettings.findUniqueOrThrow({ where: { id: "default" } });
  const context = buildMergeContext({
    owner: {
      name: "Maria Silva",
      email: "maria@example.com",
      phone: "910000000",
      nif: "123456789",
      address: "Lisboa",
      companyName: null,
    },
    property: {
      address: "Rua do Teste 1",
      city: "Lisboa",
      typology: "APARTMENT",
      capacity: 4,
      rnal: null,
    },
    company,
    lead: { service: "AL_MANAGEMENT" },
    proposal: {
      reference: "LARO-P-2026-000",
      package: "FULL_MANAGEMENT",
      commissionPct: 20,
      commissionBase: "GROSS",
      setupFee: 250,
      photographyFee: null,
      reserveFundPct: 5,
      includedServices: "Gestão completa",
      extraServices: "Obras",
      validUntil: new Date(),
    },
  });
  const snapshot = snapshotDocument({
    sections: defaultProposalSections,
    context,
    templateId: "test",
    templateVersion: 1,
  });
  const pdf = await renderDocumentPdf({
    kind: "Proposta",
    reference: "LARO-P-2026-000",
    subtitle: "Maria Silva",
    sections: snapshot.sections,
  });
  const header = Buffer.from(pdf.subarray(0, 4)).toString();
  if (header !== "%PDF") {
    throw new Error(`PDF inválido: ${header}`);
  }
  if (!snapshot.sections.some((section) => section.body.includes("Rua do Teste 1"))) {
    throw new Error("Merge falhou");
  }
  console.log("Smoke OK", snapshot.sections.length, "secções,", pdf.byteLength, "bytes");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
