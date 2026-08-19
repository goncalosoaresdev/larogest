import type { TemplateSection } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function DocumentPreview({
  sections,
  title = "Documento",
}: {
  sections: TemplateSection[];
  title?: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {sections.map((section, index) => (
          <section key={section.id}>
            {index > 0 ? <Separator className="mb-6" /> : null}
            <h3 className="mb-2 text-sm font-medium">{section.title}</h3>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </pre>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
