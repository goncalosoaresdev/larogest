import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canLinkVisitToCareReport,
  carePhotoExtension,
  careReportFormHasNewPhotos,
  checklistBlocksOkVerdict,
  checklistHasOwnerWork,
  isCareReportPublished,
  isSafeStorageSegment,
  ownerVisibleChecklist,
  parseCareChecklist,
  snapshotCareReportForm,
} from "./care-report";
import { careReportDraftSchema } from "./validations";

describe("canLinkVisitToCareReport", () => {
  it("allows care and operation visits, not sales walkthroughs", () => {
    assert.equal(canLinkVisitToCareReport("PROPERTY_CARE"), true);
    assert.equal(canLinkVisitToCareReport("OPERATION"), true);
    assert.equal(canLinkVisitToCareReport("KNOWLEDGE"), false);
  });
});

describe("isCareReportPublished", () => {
  it("only published reports are owner-visible", () => {
    assert.equal(isCareReportPublished("PUBLISHED"), true);
    assert.equal(isCareReportPublished("DRAFT"), false);
  });
});

describe("careReportFormSchema", () => {
  const valid = {
    propertyId: "prop_1",
    visitedAt: "2026-08-21T10:00",
    visitedByName: "Ana",
    verdict: "OK",
    summary: "Casa arejada, sem cheiros. Recolhemos o correio e confirmámos portas e água.",
  };

  it("accepts a short or empty summary", () => {
    assert.equal(careReportDraftSchema.safeParse({ ...valid, summary: "Portas" }).success, true);
    assert.equal(careReportDraftSchema.safeParse({ ...valid, summary: "" }).success, true);
    assert.equal(careReportDraftSchema.safeParse(valid).success, true);
    assert.equal(careReportDraftSchema.safeParse({ ...valid, visitedByName: "A" }).success, false);
  });
});

describe("care photos", () => {
  it("maps jpeg/png/webp and rejects other types and path segments", () => {
    assert.equal(carePhotoExtension("image/jpeg"), "jpg");
    assert.equal(carePhotoExtension("image/heic"), null);
    assert.equal(isSafeStorageSegment("clxyz0123456789abcdefgh"), true);
    assert.equal(isSafeStorageSegment("../secret"), false);
  });
});

describe("care checklist", () => {
  it("defaults missing rows to skipped and rejects a bad status", () => {
    const parsed = parseCareChecklist({ "check.DOORS": "DONE", "note.DOORS": "Fechadas" });
    assert.equal("error" in parsed, false);
    if ("error" in parsed) return;
    assert.equal(parsed[0]?.key, "DOORS");
    assert.equal(parsed[0]?.status, "DONE");
    assert.equal(parsed[0]?.note, "Fechadas");
    assert.equal(parsed[1]?.status, "SKIPPED");
    assert.equal("error" in parseCareChecklist({ "check.DOORS": "MAYBE" }), true);
  });

  it("blocks Tudo OK when a row needs attention, and hides skipped jobs from the owner", () => {
    const items = [
      { key: "DOORS" as const, status: "DONE" as const, note: null },
      { key: "WATER" as const, status: "ATTENTION" as const, note: "Torneira a pingar" },
      { key: "MAIL" as const, status: "SKIPPED" as const, note: null },
    ];
    assert.equal(checklistHasOwnerWork(items), true);
    const skipped = [{ key: "DOORS" as const, status: "SKIPPED" as const, note: null }];
    assert.equal(checklistHasOwnerWork(skipped), false);
    assert.equal(checklistBlocksOkVerdict(items, "OK"), true);
    assert.equal(checklistBlocksOkVerdict(items, "ATTENTION"), false);
    assert.deepEqual(
      ownerVisibleChecklist(items).map((item) => item.key),
      ["WATER", "DOORS"],
    );
  });
});

describe("snapshotCareReportForm", () => {
  it("keeps submitted fields, notes, and photos that were not marked for removal", () => {
    const form = new FormData();
    form.set("id", "rep_1");
    form.set("propertyId", "prop_1");
    form.set("visitId", "vis_1");
    form.set("visitedAt", "2026-08-21T10:00");
    form.set("visitedByName", "Ana");
    form.set("verdict", "ATTENTION");
    form.set("summary", "Torneira a pingar");
    form.set("nextVisitAt", "2026-09-01T10:00");
    form.set("check.DOORS", "DONE");
    form.set("note.DOORS", "Fechadas");
    form.set("check.WATER", "ATTENTION");
    form.set("note.WATER", "Torneira");
    form.append("keepPhoto", "DOORS:photo_1");
    form.append("keepPhoto", "WATER:photo_2");
    form.append("removePhoto", "photo_2");

    const snap = snapshotCareReportForm(form);
    assert.equal(snap.id, "rep_1");
    assert.equal(snap.propertyId, "prop_1");
    assert.equal(snap.visitId, "vis_1");
    assert.equal(snap.verdict, "ATTENTION");
    assert.equal(snap.summary, "Torneira a pingar");
    assert.equal(snap.checklist[0]?.status, "DONE");
    assert.equal(snap.checklist[0]?.note, "Fechadas");
    assert.deepEqual(snap.checklist[0]?.photos, [{ id: "photo_1", remove: false }]);
    const water = snap.checklist.find((row) => row.key === "WATER");
    assert.equal(water?.status, "ATTENTION");
    assert.deepEqual(water?.photos, [{ id: "photo_2", remove: true }]);
    assert.equal(snap.checklist.find((row) => row.key === "MAIL")?.status, "SKIPPED");
  });

  it("falls back to OK when the verdict is missing", () => {
    const form = new FormData();
    form.set("visitedByName", "Ana");
    assert.equal(snapshotCareReportForm(form).verdict, "OK");
  });

  it("detects new photo files that the browser cannot restore", () => {
    const empty = new FormData();
    assert.equal(careReportFormHasNewPhotos(empty), false);
    const withPhoto = new FormData();
    withPhoto.append("photos.DOORS", new File(["x"], "porta.jpg", { type: "image/jpeg" }));
    assert.equal(careReportFormHasNewPhotos(withPhoto), true);
  });
});
