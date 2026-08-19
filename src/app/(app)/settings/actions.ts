"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { templateSaveSchema, companySchema } from "@/lib/validations";
import type { TemplateSection } from "@/lib/labels";

export async function saveTemplateDraft(formData: FormData) {
  await requireSession();
  const rawSections = JSON.parse(String(formData.get("sections") ?? "[]")) as TemplateSection[];
  const parsed = templateSaveSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    sections: rawSections,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Modelo inválido" };
  }

  await prisma.template.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      sections: parsed.data.sections,
      status: "DRAFT",
    },
  });

  revalidatePath("/settings/templates");
  revalidatePath(`/settings/templates/${parsed.data.id}`);
  return { ok: true };
}

export async function publishTemplate(templateId: string) {
  await requireSession();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return { error: "Modelo não encontrado" };

  const lastRevision = await prisma.templateRevision.findFirst({
    where: { templateId },
    orderBy: { version: "desc" },
  });
  const version = (lastRevision?.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.template.update({
      where: { id: templateId },
      data: {
        status: "PUBLISHED",
        version,
        publishedAt: new Date(),
      },
    }),
    prisma.templateRevision.create({
      data: {
        templateId,
        version,
        sections: template.sections as object,
      },
    }),
  ]);

  revalidatePath("/settings/templates");
  revalidatePath(`/settings/templates/${templateId}`);
  return { ok: true, version };
}

export async function saveCompany(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    nif: formData.get("nif"),
    address: formData.get("address"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website") || "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });

  revalidatePath("/settings/company");
}
