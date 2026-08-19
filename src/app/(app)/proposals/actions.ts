"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { getCompany } from "@/lib/company";
import { nextProposalReference } from "@/lib/references";
import { proposalFormSchema } from "@/lib/validations";
import { buildMergeContext, snapshotDocument } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf";
import { savePdf } from "@/lib/storage";
import { sendEmail, staffEmailError } from "@/lib/email";
import type { TemplateSection } from "@/lib/labels";
import { getBaseUrl } from "@/lib/base-url";

async function getPublishedTemplate(type: "PROPOSAL" | "CONTRACT") {
  const template = await prisma.template.findFirst({
    where: { type, status: "PUBLISHED" },
    orderBy: { version: "desc" },
    include: { revisions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!template) {
    throw new Error(`Não há modelo publicado de ${type === "PROPOSAL" ? "proposta" : "contrato"}.`);
  }
  const sections = (template.revisions[0]?.sections ?? template.sections) as TemplateSection[];
  return { template, sections };
}

export async function createProposal(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = proposalFormSchema.safeParse({
    leadId: formData.get("leadId"),
    package: formData.get("package"),
    commissionPct: formData.get("commissionPct"),
    commissionBase: formData.get("commissionBase"),
    includedServices: formData.get("includedServices"),
    extraServices: formData.get("extraServices"),
    validDays: formData.get("validDays") || 14,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data.leadId },
    include: { person: true, property: true },
  });
  if (!lead?.property) {
    throw new Error("A lead precisa de um imóvel antes da proposta.");
  }

  const { template, sections } = await getPublishedTemplate("PROPOSAL");
  const company = await getCompany();
  const reference = await nextProposalReference();
  const validUntil = addDays(new Date(), parsed.data.validDays);

  const commercial = {
    reference,
    package: parsed.data.package,
    commissionPct: parsed.data.commissionPct,
    commissionBase: parsed.data.commissionBase,
    setupFee: null,
    photographyFee: null,
    reserveFundPct: null,
    includedServices: parsed.data.includedServices ?? "",
    extraServices: parsed.data.extraServices ?? "",
    validUntil,
  };

  const context = buildMergeContext({
    owner: lead.person,
    property: lead.property,
    company,
    proposal: commercial,
    lead: { service: lead.service },
  });
  const snapshot = snapshotDocument({
    sections,
    context,
    templateId: template.id,
    templateVersion: template.version,
  });

  const active = await prisma.proposal.findMany({
    where: {
      leadId: lead.id,
      status: { in: ["DRAFT", "SENT", "VIEWED"] },
    },
  });
  if (active.length) {
    await prisma.proposal.updateMany({
      where: { id: { in: active.map((item) => item.id) } },
      data: { status: "SUPERSEDED" },
    });
    for (const item of active) {
      await logActivity({
        leadId: lead.id,
        entityType: "proposal",
        entityId: item.id,
        action: "proposal_superseded",
        actorId: session.user.id,
      });
    }
  }

  const proposal = await prisma.proposal.create({
    data: {
      reference,
      leadId: lead.id,
      propertyId: lead.property.id,
      templateId: template.id,
      templateVersion: template.version,
      package: parsed.data.package,
      commissionPct: parsed.data.commissionPct,
      commissionBase: parsed.data.commissionBase,
      includedServices: parsed.data.includedServices ?? "",
      extraServices: parsed.data.extraServices ?? "",
      validUntil,
      snapshot,
      publicToken: nanoid(24),
    },
  });

  const pdf = await renderDocumentPdf({
    kind: "Proposta",
    reference,
    subtitle: lead.person.name,
    sections: snapshot.sections,
  });
  const pdfPath = await savePdf(reference, Buffer.from(pdf));
  await prisma.proposal.update({ where: { id: proposal.id }, data: { pdfPath } });

  await logActivity({
    leadId: lead.id,
    entityType: "proposal",
    entityId: proposal.id,
    action: "proposal_created",
    actorId: session.user.id,
    payload: { reference },
  });

  if (lead.status === "NEW" || lead.status === "CONTACTED" || lead.status === "QUALIFIED") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: active.length ? "NEGOTIATING" : "QUALIFIED" },
    });
  } else if (active.length) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "NEGOTIATING" },
    });
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.id}`);
  redirect(`/proposals/${proposal.id}`);
}

export async function sendProposal(proposalId: string) {
  const session = await requireSession();
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: { include: { person: true } } },
  });
  if (!proposal) return { error: "Proposta não encontrada" };
  if (!proposal.lead.person.email) {
    return { error: "A lead não tem email. Acrescenta-o na ficha antes de enviar." };
  }

  const baseUrl = await getBaseUrl();
  const link = `${baseUrl}/p/${proposal.publicToken}`;
  const company = await getCompany();
  let email;
  try {
    email = await sendEmail({
      to: proposal.lead.person.email,
      subject: `Proposta ${proposal.reference} · Laro`,
      html: `<p>Olá ${proposal.lead.person.name},</p>
<p>Segue a proposta ${proposal.reference} da Laro.</p>
<p><a href="${link}">Abrir proposta</a></p>
<p>A proposta é válida até à data indicada no documento.</p>`,
      text: `Proposta ${proposal.reference}: ${link}`,
      replyTo: company.email,
    });
  } catch (error) {
    return { error: staffEmailError(error) };
  }

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: "SENT", sentAt: new Date() },
  });
  await prisma.lead.update({
    where: { id: proposal.leadId },
    data: { status: proposal.lead.status === "NEGOTIATING" ? "NEGOTIATING" : "PROPOSAL_SENT" },
  });
  await logActivity({
    leadId: proposal.leadId,
    entityType: "proposal",
    entityId: proposal.id,
    action: "proposal_sent",
    actorId: session.user.id,
    payload: { delivered: email.delivered, link },
  });

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/leads/${proposal.leadId}`);
  revalidatePath("/leads");
  return { ok: true, link, delivered: email.delivered };
}

export async function markProposalViewed(token: string) {
  const proposal = await prisma.proposal.findUnique({ where: { publicToken: token } });
  if (!proposal) return;
  if (proposal.status === "SENT") {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    await logActivity({
      leadId: proposal.leadId,
      entityType: "proposal",
      entityId: proposal.id,
      action: "proposal_viewed",
    });
  }
}

export async function acceptProposalByToken(token: string) {
  const proposal = await prisma.proposal.findUnique({ where: { publicToken: token } });
  if (!proposal) return { error: "Proposta não encontrada" };
  if (proposal.status === "EXPIRED" || proposal.validUntil < new Date()) {
    await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "EXPIRED" } });
    return { error: "Esta proposta já expirou." };
  }
  if (proposal.status === "SUPERSEDED" || proposal.status === "REJECTED") {
    return { error: "Esta proposta já não está activa." };
  }

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  await prisma.lead.update({
    where: { id: proposal.leadId },
    data: { status: "WON" },
  });
  await logActivity({
    leadId: proposal.leadId,
    entityType: "proposal",
    entityId: proposal.id,
    action: "proposal_accepted",
  });
  return { ok: true };
}

export async function rejectProposalByToken(token: string, reason: string) {
  const proposal = await prisma.proposal.findUnique({ where: { publicToken: token } });
  if (!proposal) return { error: "Proposta não encontrada" };
  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectedReason: reason || "Não indicado" },
  });
  await prisma.lead.update({
    where: { id: proposal.leadId },
    data: { status: "LOST", lostReason: reason || "Proposta recusada" },
  });
  await logActivity({
    leadId: proposal.leadId,
    entityType: "proposal",
    entityId: proposal.id,
    action: "proposal_rejected",
    payload: { reason },
  });
  return { ok: true };
}

export async function getProposalPublicLink(proposalId: string) {
  await requireSession();
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return null;
  const baseUrl = await getBaseUrl();
  return `${baseUrl}/p/${proposal.publicToken}`;
}
