import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createProposal } from "@/app/(app)/proposals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, NativeSelect } from "@/components/form-field";

export default async function NewProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { person: true, property: true },
  });
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted-foreground">{lead.person.name}</p>
      <h1 className="text-2xl font-semibold tracking-tight">Nova proposta</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Os números ficam congelados no documento. O contrato mais tarde só formaliza este snapshot.
      </p>
      <Card>
        <CardContent className="pt-6">
          <form action={createProposal} className="space-y-5">
            <input type="hidden" name="leadId" value={lead.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Pacote">
                <NativeSelect name="package" defaultValue="FULL_MANAGEMENT">
                  <option value="FULL_MANAGEMENT">Gestão completa</option>
                  <option value="CO_HOST">Co-host</option>
                  <option value="SETUP">Setup / lançamento</option>
                </NativeSelect>
              </FormField>
              <FormField label="Comissão %">
                <Input name="commissionPct" type="number" step="0.01" min={0} max={100} defaultValue="20" required />
              </FormField>
              <FormField label="Base da comissão">
                <NativeSelect name="commissionBase" defaultValue="GROSS">
                  <option value="GROSS">Receita bruta</option>
                  <option value="NET">Receita líquida</option>
                </NativeSelect>
              </FormField>
              <FormField label="Validade (dias)">
                <Input name="validDays" type="number" min={1} max={90} defaultValue="14" />
              </FormField>
            </div>
            <FormField label="Notas ao pacote (opcional)">
              <Textarea
                name="includedServices"
                placeholder="Ajustes a este imóvel: acesso, estacionamento, particularidades da limpeza…"
              />
            </FormField>
            <FormField label="Extras desta proposta (opcional)">
              <Textarea
                name="extraServices"
                placeholder="Obras, reposição de equipamento ou outros custos fora da comissão."
              />
            </FormField>
            <Button type="submit">Gerar proposta</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
