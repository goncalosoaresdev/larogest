import type { CareChecklistKey } from "@/lib/care-report";

type ChecklistRow = {
  key: CareChecklistKey;
  status: string;
  note: string | null;
  photos: { id: string }[];
};

export type CareReportProof = { id: string; key: CareChecklistKey };

export type CareReportView<T extends ChecklistRow> = {
  /** Points the owner has to act on. Each gets its own block, with the note and its photos. */
  flags: T[];
  /** Settled points the visitor wrote something about. Shown as label and remark. */
  remarks: T[];
  /** Settled points with nothing to say. These collapse into a single run of names. */
  covered: T[];
  /** Photos of settled points, shown as one contact sheet. Flag photos stay with their flag. */
  proofs: CareReportProof[];
  /** An odd sheet leads with one wide frame so the grid always ends flush. */
  leadProof: boolean;
  photoCount: number;
};

export function careReportView<T extends ChecklistRow>(checklist: T[]): CareReportView<T> {
  const flags = checklist.filter((row) => row.status === "ATTENTION");
  const settled = checklist.filter((row) => row.status !== "ATTENTION");
  const proofs = settled.flatMap((row) => row.photos.map((photo) => ({ id: photo.id, key: row.key })));
  return {
    flags,
    remarks: settled.filter((row) => Boolean(row.note)),
    covered: settled.filter((row) => !row.note),
    proofs,
    leadProof: proofs.length % 2 === 1,
    photoCount: checklist.reduce((sum, row) => sum + row.photos.length, 0),
  };
}
