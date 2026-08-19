import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, NativeSelect } from "@/components/form-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { activatePulseOnProperty, createPulseSite } from "@/app/(app)/pulse/actions";
import { PulseSiteControls } from "@/components/pulse-site-controls";
import { formatPulseHeadline, isPulseSiteActive } from "@/lib/pulse";
import { pulseSiteStatusLabel } from "@/lib/labels";

export default async function PulsePage() {
  const [sites, properties] = await Promise.all([
    prisma.pulseSite.findMany({
      include: {
        property: { include: { person: true } },
        devices: true,
        alerts: {
          where: { status: { in: ["OPEN", "ACKED"] } },
          orderBy: { triggeredAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.property.findMany({
      where: { pulseSite: null },
      include: { person: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const openAlerts = sites.reduce((count, site) => {
    if (!isPulseSiteActive(site.status)) return count;
    return count + site.alerts.filter((alert) => alert.status === "OPEN").length;
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pulse"
        description="Sensores no imóvel, importados do fornecedor ligado a cada casa. Podes acrescentar mais dispositivos na app do fornecedor e sincronizar."
      />

      {openAlerts ? (
        <p className="text-sm text-destructive">
          <Link href="/pulse/alertas" className="hover:underline">
            {openAlerts} alerta{openAlerts === 1 ? "" : "s"} aberto{openAlerts === 1 ? "" : "s"} — abrir o quadro
          </Link>
        </p>
      ) : null}

      <Card className="py-0">
        {sites.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Ainda não há imóveis com Pulse. Activa abaixo e importa os sensores da casa.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última leitura</TableHead>
                <TableHead>Alertas</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => {
                const lastSeen = site.devices
                  .map((device) => device.lastSeenAt)
                  .filter((value): value is Date => Boolean(value))
                  .sort((a, b) => b.getTime() - a.getTime())[0];
                const headlineDevice =
                  site.devices.find((device) => device.kind === "WATER") ??
                  site.devices.find((device) => device.lastSeenAt) ??
                  site.devices[0];
                const openCount = site.alerts.filter((alert) => alert.status === "OPEN").length;
                const active = isPulseSiteActive(site.status);
                return (
                  <TableRow key={site.id} className={!active ? "opacity-70" : undefined}>
                    <TableCell>
                      <Link href={`/pulse/${site.id}`} className="text-sm hover:underline">
                        {[site.property.address, site.property.city].filter(Boolean).join(" · ")}
                      </Link>
                    </TableCell>
                    <TableCell>{site.property.person.name}</TableCell>
                    <TableCell>
                      {active ? (
                        headlineDevice ? formatPulseHeadline(headlineDevice) : "Sem dispositivos"
                      ) : (
                        <StatusBadge status={site.status}>
                          {pulseSiteStatusLabel[site.status as keyof typeof pulseSiteStatusLabel] ??
                            site.status}
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(lastSeen)}</TableCell>
                    <TableCell>
                      {openCount ? (
                        <StatusBadge status="OPEN">{openCount} abertos</StatusBadge>
                      ) : (
                        <span className="text-muted-foreground">Nenhum</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <PulseSiteControls siteId={site.id} status={site.status} compact />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={activatePulseOnProperty}>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Activar num imóvel existente</CardTitle>
              <CardDescription>
                Liga o Pulse ao imóvel. Os dispositivos vêm depois da casa do fornecedor, não de um kit fixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todos os imóveis já têm Pulse, ou ainda não há imóveis no CRM.</p>
              ) : (
                <FormField label="Imóvel">
                  <NativeSelect name="propertyId" required>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.person.name} · {property.address}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              )}
            </CardContent>
            {properties.length ? (
              <CardFooter>
                <Button type="submit">Activar Pulse</Button>
              </CardFooter>
            ) : null}
          </Card>
        </form>

        <form action={createPulseSite}>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Novo imóvel só para Pulse</CardTitle>
              <CardDescription>
                Se o imóvel ainda não está no CRM, cria a ficha e activa o Pulse. Não cria lead.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Proprietário">
                  <Input name="ownerName" required />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Morada">
                  <Input name="address" required />
                </FormField>
              </div>
              <FormField label="Cidade">
                <Input name="city" />
              </FormField>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="outline">
                Criar e activar
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>

      <p className="text-sm text-muted-foreground">
        O Pulse só vê o que estiver emparelhado na app do fornecedor. Depois de adicionares sensores, sincroniza a casa no
        Pulse.{" "}
        <Link href="/leads" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}>
          Ir às leads
        </Link>
      </p>
    </div>
  );
}
