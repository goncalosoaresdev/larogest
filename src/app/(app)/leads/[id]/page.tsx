import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { activityLabel } from "@/lib/audit";
import {
  leadServiceLabel,
  leadSourceLabel,
  leadStatusLabel,
  LEAD_STATUSES,
  packageLabel,
  proposalStatusLabel,
  typologyLabel,
  visitKindLabel,
  visitStatusLabel,
} from "@/lib/labels";
import { formatDate, formatDateTime, formatPercent, toNumber } from "@/lib/format";
import { addLeadNote, updateLeadDetails, updateLeadStatus } from "@/app/(app)/leads/actions";
import { scheduleVisit, completeVisit, cancelVisit } from "@/app/(app)/visitas/actions";
import { activatePulseOnLead } from "@/app/(app)/pulse/actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField, NativeSelect } from "@/components/form-field";
import { cn } from "@/lib/utils";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      person: true,
      property: { include: { pulseSite: true } },
      assignedTo: true,
      proposals: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, include: { actor: true } },
      visits: { orderBy: { scheduledAt: "desc" } },
    },
  });
  if (!lead) notFound();

  const updateStatus = updateLeadStatus.bind(null, lead.id);
  const addNote = addLeadNote.bind(null, lead.id);
  const updateDetails = updateLeadDetails.bind(null, lead.id);
  const schedule = scheduleVisit;
  const address = [lead.property?.address, lead.property?.city].filter(Boolean).join(" · ");
  const defaultVisitKind = lead.service === "SCHEDULED_VISITS" ? "PROPERTY_CARE" : "KNOWLEDGE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {leadServiceLabel[lead.service]} · {leadSourceLabel[lead.source]} · {formatDate(lead.createdAt)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.person.name}</h1>
            <StatusBadge status={lead.status}>{leadStatusLabel[lead.status]}</StatusBadge>
          </div>
          {address ? <p className="text-sm text-muted-foreground">{address}</p> : null}
        </div>
        <Link href={`/leads/${lead.id}/proposal`} className={cn(buttonVariants())}>
          Nova proposta
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <div className="space-y-6">
          <form action={updateDetails}>
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Ficha</CardTitle>
                <CardDescription>Dados do proprietário e do imóvel.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                <FormField label="Serviço">
                  <NativeSelect name="service" defaultValue={lead.service}>
                    <option value="AL_MANAGEMENT">Gestão de alojamento local</option>
                    <option value="SCHEDULED_VISITS">Visitas programadas</option>
                  </NativeSelect>
                </FormField>
                <FormField label="Nome">
                  <Input name="name" defaultValue={lead.person.name} />
                </FormField>
                <FormField label="Email">
                  <Input name="email" type="email" defaultValue={lead.person.email ?? ""} />
                </FormField>
                <FormField label="Telefone">
                  <Input name="phone" defaultValue={lead.person.phone ?? ""} />
                </FormField>
                <FormField label="NIF">
                  <Input name="nif" defaultValue={lead.person.nif ?? ""} />
                </FormField>
                <FormField label="Morada do proprietário">
                  <Input name="ownerAddress" defaultValue={lead.person.address ?? ""} />
                </FormField>
                <FormField label="Empresa">
                  <Input name="companyName" defaultValue={lead.person.companyName ?? ""} />
                </FormField>
                <FormField label="Morada do imóvel">
                  <Input name="address" defaultValue={lead.property?.address ?? ""} />
                </FormField>
                <FormField label="Cidade">
                  <Input name="city" defaultValue={lead.property?.city ?? ""} />
                </FormField>
                <FormField label="Tipologia">
                  <NativeSelect name="typology" defaultValue={lead.property?.typology ?? "APARTMENT"}>
                    {Object.entries(typologyLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Capacidade">
                  <Input
                    name="capacity"
                    type="number"
                    defaultValue={lead.property?.capacity != null ? String(lead.property.capacity) : ""}
                  />
                </FormField>
                <FormField label="RNAL">
                  <Input name="rnal" defaultValue={lead.property?.rnal ?? ""} />
                </FormField>
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="outline">
                  Guardar ficha
                </Button>
              </CardFooter>
            </Card>
          </form>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Visitas</CardTitle>
              <CardDescription>Visita de conhecimento, property care ou operação no imóvel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <form action={schedule} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <FormField label="Tipo">
                  <NativeSelect name="kind" defaultValue={defaultVisitKind}>
                    <option value="KNOWLEDGE">Visita de conhecimento</option>
                    <option value="PROPERTY_CARE">Visita programada</option>
                    <option value="OPERATION">Check-in / operação</option>
                  </NativeSelect>
                </FormField>
                <FormField label="Data e hora">
                  <Input name="scheduledAt" type="datetime-local" required />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notas (opcional)">
                    <Input name="notes" placeholder="Quem vai, acesso, o que verificar…" />
                  </FormField>
                </div>
                <div>
                  <Button type="submit" variant="outline">
                    Agendar visita
                  </Button>
                </div>
              </form>

              {lead.visits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não há visitas nesta lead.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {lead.visits.map((visit) => {
                    const done = completeVisit.bind(null, visit.id);
                    const cancel = cancelVisit.bind(null, visit.id);
                    return (
                      <li key={visit.id} className="space-y-2 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{visitKindLabel[visit.kind]}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(visit.scheduledAt)}</p>
                          </div>
                          <StatusBadge status={visit.status}>{visitStatusLabel[visit.status]}</StatusBadge>
                        </div>
                        {visit.notes ? (
                          <p className="text-sm text-muted-foreground">{visit.notes}</p>
                        ) : null}
                        {visit.outcome ? (
                          <p className="text-sm text-muted-foreground">Registo: {visit.outcome}</p>
                        ) : null}
                        {visit.status === "SCHEDULED" ? (
                          <div className="flex flex-wrap gap-2">
                            <form action={done} className="flex min-w-0 flex-1 gap-2">
                              <Input name="outcome" placeholder="O que viste (opcional)" />
                              <Button type="submit" size="sm">
                                Feita
                              </Button>
                            </form>
                            <form action={cancel}>
                              <Button type="submit" size="sm" variant="outline">
                                Cancelar
                              </Button>
                            </form>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Propostas</CardTitle>
              <CardDescription>
                {lead.proposals.length
                  ? `${lead.proposals.length} proposta${lead.proposals.length === 1 ? "" : "s"} nesta lead.`
                  : "Ainda não há propostas nesta lead."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {lead.proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Gera a primeira a partir do botão no topo da página.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {lead.proposals.map((proposal) => (
                    <li key={proposal.id} className="flex items-center justify-between gap-4 px-3 py-3">
                      <Link href={`/proposals/${proposal.id}`} className="font-mono text-sm hover:underline">
                        {proposal.reference}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {packageLabel[proposal.package]} · {formatPercent(toNumber(proposal.commissionPct))}
                      </span>
                      <StatusBadge status={proposal.status}>{proposalStatusLabel[proposal.status]}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <form action={updateStatus}>
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <NativeSelect name="status" defaultValue={lead.status} className="w-full">
                  {LEAD_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {leadStatusLabel[status]}
                    </option>
                  ))}
                </NativeSelect>
                <FormField label="Motivo se perdida">
                  <Input name="lostReason" defaultValue={lead.lostReason ?? ""} />
                </FormField>
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="outline">
                  Actualizar estado
                </Button>
              </CardFooter>
            </Card>
          </form>

          {lead.propertyId ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Pulse</CardTitle>
                <CardDescription>Sensores no imóvel, fora da pipeline comercial.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {lead.property?.pulseSite ? (
                  <Link href={`/pulse/${lead.property.pulseSite.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                    Ver Pulse
                  </Link>
                ) : (
                  <form action={activatePulseOnLead.bind(null, lead.id)}>
                    <Button type="submit" variant="outline">
                      Activar Pulse no imóvel
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : null}

          <form action={addNote}>
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Nota</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Textarea name="note" placeholder="Registo da chamada, visita, objecção…" />
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="outline">
                  Acrescentar
                </Button>
              </CardFooter>
            </Card>
          </form>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ol className="space-y-4">
                {lead.activities.map((item) => (
                  <li key={item.id} className="border-l-2 border-border pl-3">
                    <p className="text-sm">{activityLabel[item.action] ?? item.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                      {item.actor ? ` · ${item.actor.name}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
