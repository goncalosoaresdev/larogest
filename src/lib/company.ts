import { prisma } from "@/lib/prisma";

export async function getCompany() {
  const company = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });
  if (!company) {
    throw new Error("Definições da empresa em falta. Corre o seed.");
  }
  return company;
}
