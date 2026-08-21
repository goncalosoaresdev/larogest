import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CASA_ALERT_HISTORY_DAYS,
  casaAlertHistorySince,
  isCasaInboxAlert,
  mergeCasaPastAlerts,
  parseCasaAlertHistoryCursor,
} from "./casa-alerts";
import type { CasaOwnerAlert } from "./casa";

function alert(input: Partial<CasaOwnerAlert> & Pick<CasaOwnerAlert, "id" | "status" | "triggeredAt">): CasaOwnerAlert {
  return {
    type: "MOTION",
    message: "Movimento",
    deviceId: null,
    ...input,
  };
}

describe("casa alert history", () => {
  it("looks back 30 days from now", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    assert.equal(CASA_ALERT_HISTORY_DAYS, 30);
    assert.equal(casaAlertHistorySince(now).toISOString(), "2026-07-22T12:00:00.000Z");
  });

  it("parses a cursor and rejects a bad date", () => {
    assert.equal(parseCasaAlertHistoryCursor(null, "abc"), null);
    assert.equal(parseCasaAlertHistoryCursor("2026-08-20T10:00:00.000Z", null), null);
    assert.equal(parseCasaAlertHistoryCursor("nope", "abc"), null);
    assert.deepEqual(parseCasaAlertHistoryCursor("2026-08-20T10:00:00.000Z", "alert_1"), {
      triggeredAt: "2026-08-20T10:00:00.000Z",
      id: "alert_1",
    });
  });

  it("keeps open and acked alerts in the inbox", () => {
    assert.equal(isCasaInboxAlert({ status: "OPEN" }), true);
    assert.equal(isCasaInboxAlert({ status: "ACKED" }), true);
    assert.equal(isCasaInboxAlert({ status: "RESOLVED" }), false);
  });

  it("merges live resolved alerts into fetched history without duplicates", () => {
    const live = [
      alert({ id: "new", status: "RESOLVED", triggeredAt: "2026-08-21T11:00:00.000Z" }),
      alert({ id: "dup", status: "RESOLVED", triggeredAt: "2026-08-21T09:00:00.000Z" }),
      alert({ id: "open", status: "OPEN", triggeredAt: "2026-08-21T12:00:00.000Z" }),
    ];
    const fetched = [
      alert({ id: "dup", status: "RESOLVED", triggeredAt: "2026-08-21T09:00:00.000Z" }),
      alert({ id: "old", status: "RESOLVED", triggeredAt: "2026-08-20T09:00:00.000Z" }),
    ];
    assert.deepEqual(
      mergeCasaPastAlerts(live, fetched).map((item) => item.id),
      ["new", "dup", "old"],
    );
  });
});
