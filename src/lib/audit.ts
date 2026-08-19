import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function logActivity(input: {
  leadId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  await prisma.activity.create({
    data: {
      leadId: input.leadId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId ?? null,
      payload: input.payload,
    },
  });
}

export const activityLabel: Record<string, string> = {
  lead_created: "Lead criada",
  lead_updated: "Lead actualizada",
  status_changed: "Estado alterado",
  note_added: "Nota adicionada",
  proposal_created: "Proposta criada",
  proposal_sent: "Proposta enviada",
  proposal_viewed: "Proposta aberta",
  proposal_accepted: "Proposta aceite",
  proposal_rejected: "Proposta recusada",
  proposal_superseded: "Proposta substituída",
  contract_created: "Contrato criado",
  contract_sent: "Contrato enviado",
  contract_signed_company: "Laro assinou",
  contract_signed_owner: "Proprietário assinou",
  contract_completed: "Contrato assinado por ambas as partes",
  visit_scheduled: "Visita agendada",
  visit_done: "Visita feita",
  visit_cancelled: "Visita cancelada",
  pulse_activated: "Pulse activado no imóvel",
  pulse_disabled: "Pulse desactivado",
  pulse_enabled: "Pulse activado",
  pulse_deleted: "Pulse removido",
};
