import Link from "next/link";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { LEAD_GROUPS, leadServiceLabel, leadStatusLabel } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type LeadRow = Awaited<ReturnType<typeof loadLeads>>[number];

async function loadLeads() {
  return prisma.lead.findMany({
    include: {
      person: true,
      property: true,
      visits: {
        where: { status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
        take: 1,
      },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

function place(lead: LeadRow) {
  return lead.property?.city || lead.property?.address || "Imóvel por detalhar";
}

function nextStep(lead: LeadRow) {
  const visit = lead.visits[0];
  const now = new Date();
  if (visit) {
    if (visit.scheduledAt < now) return `Visita atrasada · ${formatDateTime(visit.scheduledAt)}`;
    return `Visita ${formatDateTime(visit.scheduledAt)}`;
  }

  const proposal = lead.proposals[0];
  if (lead.status === "NEW") return "Contactar";
  if (!proposal && (lead.status === "CONTACTED" || lead.status === "QUALIFIED")) return "Preparar proposta";
  if (proposal?.status === "DRAFT") return "Enviar proposta";
  if (proposal && (proposal.status === "SENT" || proposal.status === "VIEWED")) {
    return `Proposta até ${formatDate(proposal.validUntil)}`;
  }
  if (lead.status === "WON") return "Gerar contrato";
  if (lead.status === "CONTRACT_SENT") return "Aguardar assinatura";
  return "—";
}

function attentionItems(leads: LeadRow[]) {
  const now = new Date();
  const soon = addDays(now, 2);
  const expiry = addDays(now, 3);
  const items: { href: string; title: string; detail: string }[] = [];

  for (const lead of leads) {
    if (lead.status === "LOST") continue;
    const href = `/leads/${lead.id}`;
    const detail = `${lead.person.name} · ${place(lead)}`;
    const visit = lead.visits[0];
    const proposal = lead.proposals[0];

    if (visit && visit.scheduledAt < now) {
      items.push({ href, title: "Visita atrasada", detail: `${detail} · ${formatDateTime(visit.scheduledAt)}` });
      continue;
    }
    if (visit && visit.scheduledAt <= soon) {
      items.push({ href, title: "Visita próxima", detail: `${detail} · ${formatDateTime(visit.scheduledAt)}` });
      continue;
    }
    if (lead.status === "NEW") {
      items.push({ href, title: "Por contactar", detail });
      continue;
    }
    if (
      proposal &&
      (proposal.status === "SENT" || proposal.status === "VIEWED") &&
      proposal.validUntil <= expiry
    ) {
      items.push({
        href,
        title: "Proposta a caducar",
        detail: `${detail} · até ${formatDate(proposal.validUntil)}`,
      });
    }
  }

  return items;
}

export default async function LeadsPage() {
  const leads = await loadLeads();
  const open = leads.filter((lead) => lead.status !== "LOST");
  const lost = leads.filter((lead) => lead.status === "LOST");
  const attention = attentionItems(open);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="O que precisa de ti hoje, e onde está cada proprietário."
        action={
          <Link href="/leads/new" className={cn(buttonVariants())}>
            Nova lead
          </Link>
        }
      />

      {attention.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">A tratar</h2>
          <Card className="py-0">
            <ul className="divide-y">
              {attention.map((item) => (
                <li key={`${item.href}-${item.title}`}>
                  <Link href={item.href} className="block px-4 py-3 hover:bg-muted/50">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : open.length ? (
        <p className="text-sm text-muted-foreground">Nada urgente hoje. As leads estão abaixo.</p>
      ) : null}

      {open.length === 0 ? (
        <Card>
          <p className="p-6 text-sm text-muted-foreground">
            Ainda não há leads. Cria a primeira para começar o acompanhamento.
          </p>
        </Card>
      ) : (
        LEAD_GROUPS.map((group) => {
          const rows = open.filter((lead) =>
            (group.statuses as readonly string[]).includes(lead.status),
          );
          return (
            <section key={group.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">{group.label}</h2>
                <span className="text-xs text-muted-foreground">{rows.length}</span>
              </div>
              <Card className="py-0">
                {rows.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nenhuma lead nesta fase.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proprietário</TableHead>
                        <TableHead>Imóvel</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Próximo passo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                              {lead.person.name}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground">
                            {place(lead)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={lead.service === "SCHEDULED_VISITS" ? "secondary" : "outline"}>
                              {leadServiceLabel[lead.service]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={lead.status}>{leadStatusLabel[lead.status]}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{nextStep(lead)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </section>
          );
        })
      )}

      {lost.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Perdidas</h2>
          <Card className="py-0">
            <ul className="divide-y">
              {lost.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                  >
                    <span className="text-sm">{lead.person.name}</span>
                    <span className="text-sm text-muted-foreground">{lead.lostReason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
