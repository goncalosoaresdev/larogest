"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { CareChecklistKey, CareChecklistStatus, CareReportStatus, CareReportVerdict } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  CARE_CHECKLIST_KEYS,
  CARE_REPORT_PHOTO_MAX,
  CARE_REPORT_PHOTO_MAX_BYTES,
  CARE_REPORT_PHOTO_MAX_PER_ITEM,
  canLinkVisitToCareReport,
  carePhotoExtension,
  careReportFormHasNewPhotos,
  checklistHasOwnerWork,
  checklistBlocksOkVerdict,
  parseCareChecklist,
  snapshotCareReportForm,
  type CareReportFormSnapshot,
} from "@/lib/care-report";
import { careReportDraftSchema, careReportPublishSchema } from "@/lib/validations";
import { deleteCarePhoto, saveCarePhoto } from "@/lib/storage";

export type CareReportActionState = {
  error: string;
  values: CareReportFormSnapshot;
  at: number;
} | null;

function fail(formData: FormData, error: string, prev: CareReportActionState): CareReportActionState {
  const lostPhotos = careReportFormHasNewPhotos(formData);
  return {
    error: lostPhotos ? `${error} As fotos novas precisam de ser escolhidas outra vez.` : error,
    values: snapshotCareReportForm(formData),
    at: (prev?.at ?? 0) + 1,
  };
}

function parseOptionalDate(value: string | undefined) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida");
  return date;
}

function parsedReport(formData: FormData, publish: boolean) {
  const schema = publish ? careReportPublishSchema : careReportDraftSchema;
  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    propertyId: formData.get("propertyId"),
    visitId: formData.get("visitId") || undefined,
    visitedAt: formData.get("visitedAt"),
    visitedByName: formData.get("visitedByName"),
    verdict: formData.get("verdict"),
    summary: String(formData.get("summary") ?? ""),
    nextVisitAt: formData.get("nextVisitAt") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" as const, data: null };
  }
  return { error: null, data: parsed.data };
}

async function resolveProperty(input: { propertyId: string; visitId?: string }) {
  const visitId = input.visitId?.trim() || null;
  if (!visitId) {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true },
    });
    if (!property) throw new Error("Imóvel não encontrado");
    return { propertyId: property.id, visitId: null, existingReportId: undefined };
  }

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, kind: true, propertyId: true, careReport: { select: { id: true } } },
  });
  if (!visit) throw new Error("Visita não encontrada");
  if (!canLinkVisitToCareReport(visit.kind)) {
    throw new Error("Visitas de conhecimento não vão para a Casa");
  }
  if (!visit.propertyId) throw new Error("Esta visita não tem imóvel");
  if (visit.propertyId !== input.propertyId) {
    throw new Error("A visita não é deste imóvel");
  }
  return { propertyId: visit.propertyId, visitId: visit.id, existingReportId: visit.careReport?.id };
}

function incomingPhotos(formData: FormData, key: string) {
  return formData
    .getAll(`photos.${key}`)
    .filter((value): value is File => typeof File !== "undefined" && value instanceof File && value.size > 0);
}

async function persistCareReport(
  formData: FormData,
  publish: boolean,
  prev: CareReportActionState,
): Promise<CareReportActionState> {
  await requireSession();
  const parsed = parsedReport(formData, publish);
  if (parsed.error || !parsed.data) return fail(formData, parsed.error ?? "Dados inválidos", prev);

  const data = parsed.data;
  const checklist = parseCareChecklist(
    Object.fromEntries(
      CARE_CHECKLIST_KEYS.flatMap((key) => [
        [`check.${key}`, String(formData.get(`check.${key}`) ?? "")],
        [`note.${key}`, String(formData.get(`note.${key}`) ?? "")],
      ]),
    ),
  );
  if ("error" in checklist) return fail(formData, checklist.error, prev);
  if (publish && !checklistHasOwnerWork(checklist)) {
    return fail(formData, "Marca pelo menos um ponto como feito ou atenção.", prev);
  }
  if (checklistBlocksOkVerdict(checklist, data.verdict)) {
    return fail(formData, "Há pontos em atenção. Muda o veredicto.", prev);
  }

  try {
    const link = await resolveProperty(data);
    if (link.existingReportId && link.existingReportId !== data.id) {
      return fail(formData, "Esta visita já tem um relatório", prev);
    }

    const removeIds = formData.getAll("removePhoto").map(String).filter(Boolean);
    const filesByKey = Object.fromEntries(
      CARE_CHECKLIST_KEYS.map((key) => [key, incomingPhotos(formData, key)]),
    ) as Record<(typeof CARE_CHECKLIST_KEYS)[number], File[]>;

    for (const files of Object.values(filesByKey)) {
      for (const file of files) {
        if (!carePhotoExtension(file.type)) return fail(formData, "Usa JPEG, PNG ou WebP", prev);
        if (file.size > CARE_REPORT_PHOTO_MAX_BYTES) return fail(formData, "Cada foto pode ter no máximo 4 MB", prev);
      }
    }

    const existingItems = data.id
      ? await prisma.careReportItem.findMany({
          where: { reportId: data.id },
          include: { photos: { select: { id: true, path: true, sortOrder: true } } },
        })
      : [];

    let remainingTotal = 0;
    for (const key of CARE_CHECKLIST_KEYS) {
      const item = existingItems.find((row) => row.key === key);
      const remaining = (item?.photos ?? []).filter((photo) => !removeIds.includes(photo.id));
      const incoming = filesByKey[key];
      if (remaining.length + incoming.length > CARE_REPORT_PHOTO_MAX_PER_ITEM) {
        return fail(formData, "No máximo 3 fotos por ponto", prev);
      }
      remainingTotal += remaining.length + incoming.length;
    }
    if (remainingTotal > CARE_REPORT_PHOTO_MAX) return fail(formData, "No máximo 8 fotos", prev);

    const existingReport = data.id
      ? await prisma.careReport.findUnique({ where: { id: data.id }, select: { status: true, publishedAt: true } })
      : null;
    if (data.id && !existingReport) return fail(formData, "Relatório não encontrado", prev);

    const payload = {
      propertyId: link.propertyId,
      visitId: link.visitId,
      visitedAt: parseOptionalDate(data.visitedAt) ?? new Date(),
      visitedByName: data.visitedByName.trim(),
      verdict: data.verdict as CareReportVerdict,
      summary: data.summary.trim(),
      nextVisitAt: parseOptionalDate(data.nextVisitAt),
    };

    const report = data.id
      ? await prisma.careReport.update({ where: { id: data.id }, data: payload })
      : await prisma.careReport.create({
          data: { ...payload, status: CareReportStatus.DRAFT, publishedAt: null },
        });

    for (const [index, row] of checklist.entries()) {
      const item = await prisma.careReportItem.upsert({
        where: { reportId_key: { reportId: report.id, key: row.key as CareChecklistKey } },
        create: {
          reportId: report.id,
          key: row.key as CareChecklistKey,
          status: row.status as CareChecklistStatus,
          note: row.note,
          sortOrder: index,
        },
        update: {
          status: row.status as CareChecklistStatus,
          note: row.note,
          sortOrder: index,
        },
        include: { photos: { select: { id: true, path: true, sortOrder: true } } },
      });

      const removed = item.photos.filter((photo) => removeIds.includes(photo.id));
      if (removed.length) {
        await prisma.careReportPhoto.deleteMany({ where: { id: { in: removed.map((photo) => photo.id) } } });
        await Promise.all(removed.map((photo) => deleteCarePhoto(photo.path).catch(() => undefined)));
      }

      const kept = item.photos.filter((photo) => !removeIds.includes(photo.id));
      let sortOrder = kept.reduce((max, photo) => Math.max(max, photo.sortOrder), -1) + 1;
      for (const file of filesByKey[row.key]) {
        const ext = carePhotoExtension(file.type);
        if (!ext) continue;
        const photoId = nanoid(24);
        const buffer = Buffer.from(await file.arrayBuffer());
        const relative = await saveCarePhoto(report.id, photoId, ext, buffer);
        await prisma.careReportPhoto.create({
          data: {
            id: photoId,
            itemId: item.id,
            path: relative,
            mime: file.type,
            sortOrder,
          },
        });
        sortOrder += 1;
      }
    }

    if (publish) {
      await prisma.careReport.update({
        where: { id: report.id },
        data: { status: CareReportStatus.PUBLISHED, publishedAt: existingReport?.publishedAt ?? new Date() },
      });
    }

    revalidatePath("/visitas");
    revalidatePath(`/visitas/relatorios/${report.id}`);
    revalidatePath("/casa");
    redirect(`/visitas/relatorios/${report.id}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error(error);
    return fail(formData, error instanceof Error ? error.message : "Não deu para guardar o relatório", prev);
  }
}

export async function saveCareReport(
  prev: CareReportActionState,
  formData: FormData,
): Promise<CareReportActionState> {
  return persistCareReport(formData, false, prev);
}

export async function publishCareReport(
  prev: CareReportActionState,
  formData: FormData,
): Promise<CareReportActionState> {
  return persistCareReport(formData, true, prev);
}
