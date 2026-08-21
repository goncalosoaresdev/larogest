export const CARE_REPORT_SUMMARY_MAX = 800;
export const CARE_REPORT_PHOTO_MAX = 8;
export const CARE_REPORT_PHOTO_MAX_PER_ITEM = 3;
export const CARE_REPORT_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export const CARE_CHECKLIST_KEYS = [
  "DOORS",
  "WINDOWS",
  "MAIL",
  "AIR",
  "WATER",
  "LIGHTS",
  "WASTE",
  "EXTERIOR",
] as const;

export type CareChecklistKey = (typeof CARE_CHECKLIST_KEYS)[number];
export type CareChecklistStatus = "DONE" | "SKIPPED" | "ATTENTION";

export type CareChecklistItem = {
  key: CareChecklistKey;
  status: CareChecklistStatus;
  note: string | null;
};

export const CARE_REPORT_PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export function canLinkVisitToCareReport(kind: string) {
  return kind === "PROPERTY_CARE" || kind === "OPERATION";
}

export function isCareReportPublished(status: string) {
  return status === "PUBLISHED";
}

export function carePhotoExtension(mime: string) {
  return CARE_REPORT_PHOTO_TYPES[mime as keyof typeof CARE_REPORT_PHOTO_TYPES] ?? null;
}

export function isSafeStorageSegment(value: string) {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

export function isCareChecklistKey(value: string): value is CareChecklistKey {
  return (CARE_CHECKLIST_KEYS as readonly string[]).includes(value);
}

export function isCareChecklistStatus(value: string): value is CareChecklistStatus {
  return value === "DONE" || value === "SKIPPED" || value === "ATTENTION";
}

export function parseCareChecklist(input: Record<string, string | undefined>): CareChecklistItem[] | { error: string } {
  const items: CareChecklistItem[] = [];
  for (const key of CARE_CHECKLIST_KEYS) {
    const status = input[`check.${key}`] || "SKIPPED";
    if (!isCareChecklistStatus(status)) return { error: "Estado da lista inválido" };
    const note = input[`note.${key}`]?.trim() || null;
    items.push({ key, status, note });
  }
  return items;
}

export function checklistHasOwnerWork(items: Array<{ status: string }>) {
  return items.some((item) => item.status === "DONE" || item.status === "ATTENTION");
}

export function checklistBlocksOkVerdict(items: Array<{ status: string }>, verdict: string) {
  return verdict === "OK" && items.some((item) => item.status === "ATTENTION");
}

export function ownerVisibleChecklist<T extends { status: string }>(items: T[]) {
  return items
    .filter((item) => item.status !== "SKIPPED")
    .sort((a, b) => Number(b.status === "ATTENTION") - Number(a.status === "ATTENTION"));
}

export type CareReportFormSnapshot = {
  id?: string;
  propertyId: string;
  visitId: string;
  visitedAt: string;
  visitedByName: string;
  verdict: "OK" | "ATTENTION" | "URGENT";
  summary: string;
  nextVisitAt: string;
  checklist: Array<{
    key: CareChecklistKey;
    status: CareChecklistStatus;
    note: string;
    photos: { id: string; remove?: boolean }[];
  }>;
};

export function snapshotCareReportForm(formData: FormData): CareReportFormSnapshot {
  const removeIds = new Set(formData.getAll("removePhoto").map(String).filter(Boolean));
  const photosByKey = Object.fromEntries(CARE_CHECKLIST_KEYS.map((key) => [key, [] as { id: string; remove?: boolean }[]])) as Record<
    CareChecklistKey,
    { id: string; remove?: boolean }[]
  >;
  for (const value of formData.getAll("keepPhoto")) {
    const raw = String(value);
    const split = raw.indexOf(":");
    if (split <= 0) continue;
    const key = raw.slice(0, split);
    const id = raw.slice(split + 1);
    if (!isCareChecklistKey(key) || !id) continue;
    photosByKey[key].push({ id, remove: removeIds.has(id) });
  }

  const verdictRaw = String(formData.get("verdict") ?? "OK");
  const verdict = verdictRaw === "ATTENTION" || verdictRaw === "URGENT" ? verdictRaw : "OK";
  const id = String(formData.get("id") ?? "").trim() || undefined;

  return {
    id,
    propertyId: String(formData.get("propertyId") ?? ""),
    visitId: String(formData.get("visitId") ?? ""),
    visitedAt: String(formData.get("visitedAt") ?? ""),
    visitedByName: String(formData.get("visitedByName") ?? ""),
    verdict,
    summary: String(formData.get("summary") ?? ""),
    nextVisitAt: String(formData.get("nextVisitAt") ?? ""),
    checklist: CARE_CHECKLIST_KEYS.map((key) => {
      const statusRaw = String(formData.get(`check.${key}`) ?? "SKIPPED");
      return {
        key,
        status: isCareChecklistStatus(statusRaw) ? statusRaw : "SKIPPED",
        note: String(formData.get(`note.${key}`) ?? ""),
        photos: photosByKey[key],
      };
    }),
  };
}

export function careReportFormHasNewPhotos(formData: FormData) {
  return CARE_CHECKLIST_KEYS.some((key) =>
    formData
      .getAll(`photos.${key}`)
      .some((value) => typeof File !== "undefined" && value instanceof File && value.size > 0),
  );
}
