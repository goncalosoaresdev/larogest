"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadService, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { leadFormSchema, leadStatusSchema } from "@/lib/validations";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export async function createLead(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = leadFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || "",
    phone: formData.get("phone"),
    nif: formData.get("nif"),
    ownerAddress: formData.get("ownerAddress"),
    personType: formData.get("personType") || "INDIVIDUAL",
    companyName: formData.get("companyName"),
    source: formData.get("source") || "MANUAL",
    service: formData.get("service") || "AL_MANAGEMENT",
    address: formData.get("address"),
    city: formData.get("city"),
    typology: formData.get("typology") || "APARTMENT",
    capacity: formData.get("capacity") || undefined,
    rnal: formData.get("rnal"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const data = parsed.data;
  const capacity = typeof data.capacity === "number" && !Number.isNaN(data.capacity) ? data.capacity : null;

  const person = await prisma.person.create({
    data: {
      name: data.name,
      email: emptyToNull(data.email ?? null),
      phone: emptyToNull(data.phone ?? null),
      nif: emptyToNull(data.nif ?? null),
      address: emptyToNull(data.ownerAddress ?? null),
      type: data.personType,
      companyName: emptyToNull(data.companyName ?? null),
    },
  });

  const property = await prisma.property.create({
    data: {
      personId: person.id,
      address: data.address,
      city: emptyToNull(data.city ?? null),
      typology: data.typology,
      capacity,
      rnal: emptyToNull(data.rnal ?? null),
      notes: emptyToNull(data.notes ?? null),
    },
  });

  const lead = await prisma.lead.create({
    data: {
      personId: person.id,
      propertyId: property.id,
      source: data.source,
      service: data.service,
      notes: emptyToNull(data.notes ?? null),
      assignedToId: session.user.id,
    },
  });

  await logActivity({
    leadId: lead.id,
    entityType: "lead",
    entityId: lead.id,
    action: "lead_created",
    actorId: session.user.id,
    payload: { source: data.source, service: data.service },
  });

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadStatus(leadId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = leadStatusSchema.safeParse({
    status: formData.get("status"),
    lostReason: formData.get("lostReason"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Estado inválido");
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead não encontrada");

  const status = parsed.data.status as LeadStatus;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      lostReason: status === "LOST" ? parsed.data.lostReason || "Não indicado" : null,
    },
  });

  await logActivity({
    leadId,
    entityType: "lead",
    entityId: leadId,
    action: "status_changed",
    actorId: session.user.id,
    payload: { from: lead.status, to: status, lostReason: parsed.data.lostReason },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function addLeadNote(leadId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) throw new Error("Escreve uma nota");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead não encontrada");

  const nextNotes = lead.notes ? `${lead.notes}\n\n${note}` : note;
  await prisma.lead.update({
    where: { id: leadId },
    data: { notes: nextNotes },
  });
  await logActivity({
    leadId,
    entityType: "lead",
    entityId: leadId,
    action: "note_added",
    actorId: session.user.id,
    payload: { note },
  });
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLeadDetails(leadId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { person: true, property: true },
  });
  if (!lead) throw new Error("Lead não encontrada");

  await prisma.person.update({
    where: { id: lead.personId },
    data: {
      name: String(formData.get("name") ?? lead.person.name),
      email: emptyToNull(formData.get("email")),
      phone: emptyToNull(formData.get("phone")),
      nif: emptyToNull(formData.get("nif")),
      address: emptyToNull(formData.get("ownerAddress")),
      companyName: emptyToNull(formData.get("companyName")),
    },
  });

  if (lead.propertyId) {
    const capacityRaw = String(formData.get("capacity") ?? "");
    await prisma.property.update({
      where: { id: lead.propertyId },
      data: {
        address: String(formData.get("address") ?? lead.property?.address),
        city: emptyToNull(formData.get("city")),
        typology: (formData.get("typology") as never) || lead.property?.typology,
        capacity: capacityRaw ? Number(capacityRaw) : null,
        rnal: emptyToNull(formData.get("rnal")),
      },
    });
  }

  const service = formData.get("service");
  if (service === LeadService.SCHEDULED_VISITS || service === LeadService.AL_MANAGEMENT) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { service },
    });
  }

  await logActivity({
    leadId,
    entityType: "lead",
    entityId: leadId,
    action: "lead_updated",
    actorId: session.user.id,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}
