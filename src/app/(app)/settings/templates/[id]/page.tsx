import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "@/components/template-editor";
import type { TemplateSection } from "@/lib/labels";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await prisma.template.findUnique({
    where: { id },
    include: { revisions: { orderBy: { version: "desc" }, take: 5 } },
  });
  if (!template) notFound();

  return (
    <TemplateEditor
      id={template.id}
      name={template.name}
      version={template.version}
      status={template.status}
      sections={template.sections as TemplateSection[]}
    />
  );
}
