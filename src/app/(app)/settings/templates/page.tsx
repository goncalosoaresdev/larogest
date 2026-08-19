import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: { type: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modelos"
        description="Estrutura e variáveis. O texto jurídico entra aqui — o sistema só faz merge. Publicar uma versão não altera documentos já enviados."
      />
      <Card className="py-0">
        <CardContent className="divide-y p-0">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/settings/templates/${template.id}`}
              className="flex items-center justify-between px-4 py-4 hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="font-mono text-xs text-muted-foreground">versão {template.version}</p>
              </div>
              <StatusBadge status={template.status}>
                {template.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
              </StatusBadge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
