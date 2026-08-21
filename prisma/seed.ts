import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { ensureDemoCasa } from "../src/lib/casa-demo";
import { defaultContractSections, defaultProposalSections } from "../src/lib/default-templates";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_EMAIL ?? "admin@laro.pt";
  const password = process.env.SEED_PASSWORD ?? "larogest123";
  const userId = "seed-admin";

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Laro",
      nif: "000000000",
      address: "Portugal",
      email: "ola@laro.pt",
      phone: "",
      website: "https://laro.pt",
    },
  });

  await prisma.user.upsert({
    where: { email },
    update: { name: "Equipa Laro" },
    create: {
      id: userId,
      name: "Equipa Laro",
      email,
      emailVerified: true,
    },
  });

  const hashed = await hashPassword(password);
  await prisma.account.deleteMany({
    where: { userId, providerId: "credential" },
  });
  await prisma.account.create({
    data: {
      id: "seed-admin-account",
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    },
  });

  const existingProposal = await prisma.template.findFirst({
    where: { type: "PROPOSAL" },
  });
  if (!existingProposal) {
    const template = await prisma.template.create({
      data: {
        type: "PROPOSAL",
        name: "Proposta de gestão de AL",
        version: 1,
        status: "PUBLISHED",
        sections: defaultProposalSections,
        publishedAt: new Date(),
      },
    });
    await prisma.templateRevision.create({
      data: {
        templateId: template.id,
        version: 1,
        sections: defaultProposalSections,
      },
    });
  }

  const existingContract = await prisma.template.findFirst({
    where: { type: "CONTRACT" },
  });
  if (!existingContract) {
    const template = await prisma.template.create({
      data: {
        type: "CONTRACT",
        name: "Contrato de gestão Laro",
        version: 1,
        status: "PUBLISHED",
        sections: defaultContractSections,
        publishedAt: new Date(),
      },
    });
    await prisma.templateRevision.create({
      data: {
        templateId: template.id,
        version: 1,
        sections: defaultContractSections,
      },
    });
  }

  console.log(`Seed OK. Staff: ${email} / ${password}`);
  await ensureDemoCasa(prisma);
  console.log("Casa demo: /casa/demo · Casa de Campo");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
