import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startOfLisbonDay } from "./casa-day";
import { isCasaDemoSlug, resolveCasaSiteId, stickyDemoAlertAt, CASA_DEMO, CASA_DEMO_SLUG } from "./casa-demo";

describe("demo house ids", () => {
  it("maps the public slug onto the seeded site", () => {
    assert.equal(resolveCasaSiteId("demo"), CASA_DEMO.siteId);
    assert.equal(resolveCasaSiteId(CASA_DEMO.siteId), CASA_DEMO.siteId);
    assert.equal(isCasaDemoSlug(CASA_DEMO_SLUG), true);
    assert.equal(isCasaDemoSlug("other"), false);
    assert.equal(CASA_DEMO.ownerEmail, "demo@laro.pt");
  });
});

describe("stickyDemoAlertAt", () => {
  it("stays inside today and before now in the afternoon", () => {
    const now = new Date("2026-08-21T15:00:00.000+01:00");
    const at = stickyDemoAlertAt(now);
    const from = startOfLisbonDay(now).getTime();
    assert.ok(at.getTime() >= from);
    assert.ok(at.getTime() < now.getTime());
    assert.ok(now.getTime() - at.getTime() >= 2 * 3_600_000);
  });

  it("still lands today just after midnight", () => {
    const now = new Date("2026-08-21T00:08:00.000+01:00");
    const at = stickyDemoAlertAt(now);
    assert.ok(at.getTime() >= startOfLisbonDay(now).getTime());
    assert.ok(at.getTime() <= now.getTime());
  });
});
