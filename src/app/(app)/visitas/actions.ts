"use server";

import { revalidatePath } from "next/cache";
import { LeadStatus, VisitKind, VisitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { visitFormSchema } from "@/lib/validations";

function parseLocalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data inválida");
  }
  return date;
}

export async function scheduleVisit(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = visitFormSchema.safeParse({
    leadId: formData.get("leadId"),
    kind: formData.get("kind"),
    scheduledAt: formData.get("scheduledAt"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId } });
  if (!lead) throw new Error("Lead não encontrada");

  const scheduledAt = parseLocalDateTime(parsed.data.scheduledAt);
  const visit = await prisma.visit.create({
    data: {
      leadId: lead.id,
      propertyId: lead.propertyId,
      kind: parsed.data.kind as VisitKind,
      scheduledAt,
      notes: parsed.data.notes?.trim() || null,
    },
  });

  if (lead.status === LeadStatus.NEW) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.CONTACTED },
    });
    await logActivity({
      leadId: lead.id,
      entityType: "lead",
      entityId: lead.id,
      action: "status_changed",
      actorId: session.user.id,
      payload: { from: lead.status, to: LeadStatus.CONTACTED, reason: "visita_agendada" },
    });
  }

  await logActivity({
    leadId: lead.id,
    entityType: "visit",
    entityId: visit.id,
    action: "visit_scheduled",
    actorId: session.user.id,
    payload: { kind: visit.kind, scheduledAt: visit.scheduledAt.toISOString() },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/visitas");
}

export async function completeVisit(visitId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error("Visita não encontrada");
  if (visit.status !== VisitStatus.SCHEDULED) throw new Error("Esta visita já não está agendada");

  const outcome = String(formData.get("outcome") ?? "").trim();
  await prisma.visit.update({
    where: { id: visitId },
    data: { status: VisitStatus.DONE, outcome: outcome || null },
  });

  await logActivity({
    leadId: visit.leadId,
    entityType: "visit",
    entityId: visit.id,
    action: "visit_done",
    actorId: session.user.id,
    payload: { outcome: outcome || null },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${visit.leadId}`);
  revalidatePath("/visitas");
}

export async function cancelVisit(visitId: string, _formData?: FormData): Promise<void> {
  const session = await requireSession();
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error("Visita não encontrada");
  if (visit.status !== VisitStatus.SCHEDULED) throw new Error("Esta visita já não está agendada");

  await prisma.visit.update({
    where: { id: visitId },
    data: { status: VisitStatus.CANCELLED },
  });

  await logActivity({
    leadId: visit.leadId,
    entityType: "visit",
    entityId: visit.id,
    action: "visit_cancelled",
    actorId: session.user.id,
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${visit.leadId}`);
  revalidatePath("/visitas");
}
