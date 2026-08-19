"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PLACEHOLDERS, type TemplateSection } from "@/lib/labels";
import { publishTemplate, saveTemplateDraft } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TemplateEditor({
  id,
  name,
  version,
  status,
  sections: initial,
}: {
  id: string;
  name: string;
  version: number;
  status: string;
  sections: TemplateSection[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(name);
  const [sections, setSections] = useState(initial);

  function updateSection(sectionId: string, patch: Partial<TemplateSection>) {
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
      <form
        className="space-y-5"
        action={async (formData) => {
          formData.set("id", id);
          formData.set("name", title);
          formData.set("sections", JSON.stringify(sections));
          const result = await saveTemplateDraft(formData);
          if (result.error) toast.error(result.error);
          else toast.success("Rascunho guardado. Os documentos já enviados não mudam.");
          router.refresh();
        }}
      >
        <div>
          <p className="text-sm text-muted-foreground">
            versão {version} · {status === "PUBLISHED" ? "publicado" : "rascunho"}
          </p>
          <FormField label="Nome do modelo">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </FormField>
        </div>
        {sections.map((section, index) => (
          <Card key={section.id}>
            <CardContent className="space-y-3 pt-6">
              <FormField label={`Secção ${index + 1}`}>
                <Input
                  value={section.title}
                  onChange={(event) => updateSection(section.id, { title: event.target.value })}
                />
              </FormField>
              <Textarea
                value={section.body}
                onChange={(event) => updateSection(section.id, { body: event.target.value })}
                className="min-h-40"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSections((current) => current.filter((item) => item.id !== section.id))}
              >
                Remover secção
              </Button>
            </CardContent>
          </Card>
        ))}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setSections((current) => [
                ...current,
                { id: crypto.randomUUID().slice(0, 8), title: "Nova secção", body: "" },
              ])
            }
          >
            Acrescentar secção
          </Button>
          <Button type="submit">Guardar rascunho</Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const result = await publishTemplate(id);
              if (result.error) toast.error(result.error);
              else toast.success(`Publicada a versão ${result.version}.`);
              router.refresh();
            }}
          >
            Publicar versão
          </Button>
        </div>
      </form>
      <Card className="h-fit">
        <CardHeader>
         <CardTitle>Variáveis</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh]">
            <ul className="space-y-2">
              {PLACEHOLDERS.map((item) => (
                <li key={item.key} className="text-xs">
                  <code className="font-mono text-primary">{item.key}</code>
                  <span className="ml-2 text-muted-foreground">{item.hint}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
