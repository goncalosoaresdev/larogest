"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addMonths } from "date-fns";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { getCompany } from "@/lib/company";
import { nextContractReference } from "@/lib/references";
import { contractFormSchema, signContractSchema } from "@/lib/validations";
import { buildMergeContext, snapshotDocument, sectionsFromSnapshot } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf";
import { savePdf } from "@/lib/storage";
import { ownerEmailError, sendEmail, staffEmailError } from "@/lib/email";
import { generateOtp, hashBuffer, hashOtp } from "@/lib/crypto";
import type { TemplateSection } from "@/lib/labels";
import { getBaseUrl } from "@/lib/base-url";

async function getPublishedContractTemplate() {
  const template = await prisma.template.findFirst({
    where: { type: "CONTRACT", status: "PUBLISHED" },
    orderBy: { version: "desc" },
    include: { revisions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!template) throw new Error("Não há modelo de contrato publicado.");
  const sections = (template.revisions[0]?.sections ?? template.sections) as TemplateSection[];
  return { template, sections };
}

export async function createContractFromProposal(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = contractFormSchema.safeParse({
    proposalId: formData.get("proposalId"),
    startsOn: formData.get("startsOn"),
    months: formData.get("months") || 12,
    noticeDays: formData.get("noticeDays") || 30,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: parsed.data.proposalId },
    include: {
      lead: { include: { person: true } },
      property: true,
      contract: true,
    },
  });
  if (!proposal) throw new Error("Proposta não encontrada");
  if (proposal.status !== "ACCEPTED") {
    throw new Error("Só podes gerar contrato a partir de uma proposta aceite.");
  }
  if (proposal.contract) {
    redirect(`/contracts/${proposal.contract.id}`);
  }

  const { template, sections } = await getPublishedContractTemplate();
  const company = await getCompany();
  const startsOn = new Date(parsed.data.startsOn);
  const endsOn = addMonths(startsOn, parsed.data.months);
  const reference = await nextContractReference();

  const context = buildMergeContext({
    owner: proposal.lead.person,
    property: proposal.property,
    company,
    lead: { service: proposal.lead.service },
    proposal: {
      reference: proposal.reference,
      package: proposal.package,
      commissionPct: proposal.commissionPct,
      commissionBase: proposal.commissionBase,
      setupFee: proposal.setupFee,
      photographyFee: proposal.photographyFee,
      reserveFundPct: proposal.reserveFundPct,
      includedServices: proposal.includedServices,
      extraServices: proposal.extraServices,
      validUntil: proposal.validUntil,
    },
    contract: {
      reference,
      startsOn,
      endsOn,
      noticeDays: parsed.data.noticeDays,
    },
  });
  const snapshot = snapshotDocument({
    sections,
    context,
    templateId: template.id,
    templateVersion: template.version,
  });

  const contract = await prisma.contract.create({
    data: {
      reference,
      proposalId: proposal.id,
      propertyId: proposal.propertyId,
      templateId: template.id,
      templateVersion: template.version,
      startsOn,
      endsOn,
      noticeDays: parsed.data.noticeDays,
      snapshot,
      publicToken: nanoid(24),
      signatures: {
        create: [
          {
            role: "COMPANY",
            signerName: company.name,
            signerEmail: company.email,
          },
          {
            role: "OWNER",
            signerName: proposal.lead.person.name,
            signerEmail: proposal.lead.person.email ?? "",
          },
        ],
      },
    },
  });

  const pdf = await renderDocumentPdf({
    kind: "Contrato",
    reference,
    subtitle: proposal.lead.person.name,
    sections: snapshot.sections,
  });
  const pdfPath = await savePdf(reference, Buffer.from(pdf));
  await prisma.contract.update({ where: { id: contract.id }, data: { pdfPath } });

  await logActivity({
    leadId: proposal.leadId,
    entityType: "contract",
    entityId: contract.id,
    action: "contract_created",
    actorId: session.user.id,
    payload: { reference },
  });

  revalidatePath(`/proposals/${proposal.id}`);
  redirect(`/contracts/${contract.id}`);
}

export async function signAsCompany(contractId: string, _formData: FormData): Promise<void> {
  const session = await requireSession();
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { signatures: true, proposal: true },
  });
  if (!contract) throw new Error("Contrato não encontrado");
  if (contract.status === "SIGNED" || contract.status === "CANCELLED") {
    throw new Error("Este contrato já não pode ser assinado.");
  }

  const headerList = await headers();
  await prisma.signature.update({
    where: { contractId_role: { contractId, role: "COMPANY" } },
    data: {
      signedAt: new Date(),
      typedName: session.user.name,
      ip: headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip"),
      userAgent: headerList.get("user-agent"),
      otpVerified: true,
    },
  });

  await logActivity({
    leadId: contract.proposal.leadId,
    entityType: "contract",
    entityId: contract.id,
    action: "contract_signed_company",
    actorId: session.user.id,
  });

  await refreshContractStatus(contractId);
  revalidatePath(`/contracts/${contractId}`);
}

export async function sendContract(contractId: string) {
  const session = await requireSession();
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { proposal: { include: { lead: { include: { person: true } } } } },
  });
  if (!contract) return { error: "Contrato não encontrado" };
  const emailTo = contract.proposal.lead.person.email;
  if (!emailTo) return { error: "O proprietário não tem email." };

  const baseUrl = await getBaseUrl();
  const link = `${baseUrl}/c/${contract.publicToken}`;
  const company = await getCompany();
  let email;
  try {
    email = await sendEmail({
      to: emailTo,
      subject: `Contrato ${contract.reference} · Laro`,
      html: `<p>Olá ${contract.proposal.lead.person.name},</p>
<p>Segue o contrato ${contract.reference} para leitura e assinatura.</p>
<p><a href="${link}">Abrir e assinar</a></p>
<p>Vais receber um código de 6 dígitos no teu email no momento da assinatura.</p>`,
      text: `Contrato ${contract.reference}: ${link}`,
      replyTo: company.email,
    });
  } catch (error) {
    return { error: staffEmailError(error) };
  }

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: contract.status === "DRAFT" ? "SENT" : contract.status, sentAt: new Date() },
  });
  await prisma.lead.update({
    where: { id: contract.proposal.leadId },
    data: { status: "CONTRACT_SENT" },
  });
  await logActivity({
    leadId: contract.proposal.leadId,
    entityType: "contract",
    entityId: contract.id,
    action: "contract_sent",
    actorId: session.user.id,
    payload: { delivered: email.delivered, link },
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/leads");
  return { ok: true, link, delivered: email.delivered };
}

export async function requestContractOtp(token: string) {
  const contract = await prisma.contract.findUnique({
    where: { publicToken: token },
    include: { proposal: { include: { lead: { include: { person: true } } } } },
  });
  if (!contract) return { error: "Contrato não encontrado" };
  const email = contract.proposal.lead.person.email;
  if (!email) return { error: "Este contrato não tem email de proprietário." };

  const company = await getCompany();
  const code = generateOtp();
  const challenge = await prisma.otpChallenge.create({
    data: {
      contractId: contract.id,
      email,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  let sent;
  try {
    sent = await sendEmail({
      to: email,
      subject: `Código de assinatura ${contract.reference}`,
      html: `<p>O teu código para assinar o contrato ${contract.reference} é:</p>
<p style="font-size:28px;letter-spacing:6px"><strong>${code}</strong></p>
<p>Expira em 15 minutos. Se não pediste este código, ignora o email.</p>`,
      text: `Código: ${code}`,
      replyTo: company.email,
    });
  } catch {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    return { error: ownerEmailError() };
  }

  return {
    ok: true,
    previewCode: !sent.delivered && process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function signContractAsOwner(formData: FormData) {
  const parsed = signContractSchema.safeParse({
    token: formData.get("token"),
    typedName: formData.get("typedName"),
    otp: formData.get("otp"),
    accepted: formData.get("accepted") === "on" || formData.get("accepted") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const contract = await prisma.contract.findUnique({
    where: { publicToken: parsed.data.token },
    include: {
      signatures: true,
      proposal: { include: { lead: { include: { person: true } } } },
    },
  });
  if (!contract) return { error: "Contrato não encontrado" };
  if (contract.status === "SIGNED" || contract.status === "CANCELLED") {
    return { error: "Este contrato já não pode ser assinado." };
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      contractId: contract.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.codeHash !== hashOtp(parsed.data.otp)) {
    return { error: "Código inválido ou expirado. Pede um novo." };
  }

  const headerList = await headers();
  await prisma.$transaction([
    prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    }),
    prisma.signature.update({
      where: { contractId_role: { contractId: contract.id, role: "OWNER" } },
      data: {
        signedAt: new Date(),
        typedName: parsed.data.typedName,
        otpVerified: true,
        ip: headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip"),
        userAgent: headerList.get("user-agent"),
      },
    }),
  ]);

  await logActivity({
    leadId: contract.proposal.leadId,
    entityType: "contract",
    entityId: contract.id,
    action: "contract_signed_owner",
  });

  await refreshContractStatus(contract.id);
  return { ok: true };
}

async function refreshContractStatus(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { signatures: true, proposal: true },
  });
  if (!contract) return;

  const signed = contract.signatures.filter((item) => item.signedAt);
  let status = contract.status;
  if (signed.length === 1) status = "PARTIALLY_SIGNED";
  if (signed.length >= 2) status = "SIGNED";

  const stamp =
    signed.length >= 2
      ? `Assinado por ambas as partes em ${new Date().toISOString()}. SHA-256 será gravado neste arquivo.`
      : undefined;

  const sections = sectionsFromSnapshot(contract.snapshot);
  const pdf = await renderDocumentPdf({
    kind: "Contrato",
    reference: contract.reference,
    subtitle: "Documento de gestão",
    sections,
    stamp: signed
      .map((item) => `${item.role}: ${item.typedName ?? item.signerName} · ${item.signedAt?.toISOString() ?? ""}`)
      .join("\n"),
  });
  const buffer = Buffer.from(pdf);
  const relative = await savePdf(
    status === "SIGNED" ? `${contract.reference}-assinado` : contract.reference,
    buffer,
  );

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status,
      pdfPath: relative,
      signedPdfPath: status === "SIGNED" ? relative : contract.signedPdfPath,
      documentHash: status === "SIGNED" ? hashBuffer(buffer) : contract.documentHash,
      signedAt: status === "SIGNED" ? new Date() : contract.signedAt,
    },
  });

  if (status === "SIGNED") {
    await prisma.lead.update({
      where: { id: contract.proposal.leadId },
      data: { status: "SIGNED" },
    });
    await logActivity({
      leadId: contract.proposal.leadId,
      entityType: "contract",
      entityId: contract.id,
      action: "contract_completed",
      payload: { hash: hashBuffer(buffer) },
    });
  }

  void stamp;
}

export async function getContractPublicLink(contractId: string) {
  await requireSession();
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return null;
  const baseUrl = await getBaseUrl();
  return `${baseUrl}/c/${contract.publicToken}`;
}
