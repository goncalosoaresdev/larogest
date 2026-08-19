import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getIntegrationReports } from "@/lib/iot";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { refreshIntegrations } from "@/app/(app)/integracoes/actions";

const statusLabel = {
  ok: "OK",
  warn: "Atenção",
  error: "Falha",
  idle: "Inactivo",
} as const;

export default async function IntegracoesPage() {
  const reports = await getIntegrationReports();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Estado das ligações com fornecedores. As sondas reutilizam contactos recentes para não gastar quota."
        action={
          <form action={refreshIntegrations}>
            <Button type="submit" variant="outline" size="sm">
              Verificar
            </Button>
          </form>
        }
      />

      <div className="grid gap-6">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{report.label}</CardTitle>
                  <CardDescription>
                    {report.cached ? "Resultado em cache · " : ""}
                    verificado {formatRelativeTime(report.checkedAt) ?? formatDateTime(report.checkedAt)}
                  </CardDescription>
                </div>
                <StatusBadge status={report.status}>{statusLabel[report.status]}</StatusBadge>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border/60 pt-0">
              {report.checks.map((check) => (
                <div key={check.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-sm text-muted-foreground">{check.detail}</p>
                  </div>
                  <StatusBadge status={check.status}>{statusLabel[check.status]}</StatusBadge>
                </div>
              ))}
              <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                <div>
                  <p className="text-sm font-medium">Uso no Pulse</p>
                  <p className="text-sm text-muted-foreground">{report.pulse.activityDetail}</p>
                </div>
                <StatusBadge status={report.pulse.activityStatus}>
                  {statusLabel[report.pulse.activityStatus]}
                </StatusBadge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
