import { prisma } from "@/lib/prisma";

async function nextSeq(prefix: "P" | "C") {
  const year = new Date().getFullYear();
  const start = `LARO-${prefix}-${year}-`;
  const last =
    prefix === "P"
      ? await prisma.proposal.findFirst({
          where: { reference: { startsWith: start } },
          orderBy: { reference: "desc" },
          select: { reference: true },
        })
      : await prisma.contract.findFirst({
          where: { reference: { startsWith: start } },
          orderBy: { reference: "desc" },
          select: { reference: true },
        });

  const current = last?.reference ? Number(last.reference.slice(start.length)) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `${start}${String(next).padStart(3, "0")}`;
}

export function nextProposalReference() {
  return nextSeq("P");
}

export function nextContractReference() {
  return nextSeq("C");
}
