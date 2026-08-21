import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { careReportView } from "./casa-report-view";
import type { CareChecklistKey } from "./care-report";

function row(key: CareChecklistKey, status: "DONE" | "ATTENTION", note: string | null = null, photos: string[] = []) {
  return { key, status, note, photos: photos.map((id) => ({ id })) };
}

describe("careReportView", () => {
  it("splits points needing action, points with a remark, and silent points", () => {
    const view = careReportView([
      row("WATER", "ATTENTION", "Torneira do jardim a pingar."),
      row("MAIL", "DONE", "Três cartas na mesa da entrada."),
      row("DOORS", "DONE"),
      row("LIGHTS", "DONE"),
    ]);
    assert.deepEqual(
      view.flags.map((item) => item.key),
      ["WATER"],
    );
    assert.deepEqual(
      view.remarks.map((item) => item.key),
      ["MAIL"],
    );
    assert.deepEqual(
      view.covered.map((item) => item.key),
      ["DOORS", "LIGHTS"],
    );
  });

  it("keeps flag photos out of the contact sheet and counts every photo", () => {
    const view = careReportView([
      row("WATER", "ATTENTION", "A pingar.", ["leak-1", "leak-2"]),
      row("EXTERIOR", "DONE", null, ["yard-1"]),
    ]);
    assert.deepEqual(view.proofs, [{ id: "yard-1", key: "EXTERIOR" }]);
    assert.equal(view.photoCount, 3);
  });

  it("keeps the contact sheet flush by leading with a wide frame on odd counts", () => {
    const sheet = (ids: string[]) => careReportView([row("DOORS", "DONE", null, ids)]);
    assert.equal(sheet([]).leadProof, false);
    assert.equal(sheet(["a"]).leadProof, true);
    assert.equal(sheet(["a", "b"]).leadProof, false);
    assert.equal(sheet(["a", "b", "c"]).leadProof, true);
    assert.equal(sheet(["a", "b", "c", "d"]).leadProof, false);
  });

  it("treats an empty remark as a silent point", () => {
    const view = careReportView([row("AIR", "DONE", "")]);
    assert.deepEqual(view.remarks, []);
    assert.deepEqual(
      view.covered.map((item) => item.key),
      ["AIR"],
    );
  });

  it("returns empty sections for a report with no owner-visible points", () => {
    const view = careReportView([]);
    assert.deepEqual(view.flags, []);
    assert.deepEqual(view.remarks, []);
    assert.deepEqual(view.covered, []);
    assert.deepEqual(view.proofs, []);
    assert.equal(view.photoCount, 0);
    assert.equal(view.leadProof, false);
  });
});
