import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CASA_NOTIFY,
  isCasaQuietHour,
  parseClockMinutes,
  selectCasaPushAlerts,
} from "./casa-notify-types";

describe("parseClockMinutes", () => {
  it("parses HH:mm and rejects invalid clocks", () => {
    assert.equal(parseClockMinutes("00:00"), 0);
    assert.equal(parseClockMinutes("22:00"), 22 * 60);
    assert.equal(parseClockMinutes("08:30"), 8 * 60 + 30);
    assert.equal(parseClockMinutes("25:00"), null);
    assert.equal(parseClockMinutes("9:00"), null);
    assert.equal(parseClockMinutes("22:60"), null);
  });
});

describe("isCasaQuietHour", () => {
  const overnight = {
    ...DEFAULT_CASA_NOTIFY,
    quietEnabled: true,
    quietStart: "22:00",
    quietEnd: "08:00",
  };

  it("is inactive when quiet hours are off", () => {
    assert.equal(isCasaQuietHour(DEFAULT_CASA_NOTIFY, new Date("2026-01-15T23:30:00Z")), false);
  });

  it("treats a Lisbon winter 23:30 as inside overnight quiet hours", () => {
    assert.equal(isCasaQuietHour(overnight, new Date("2026-01-15T23:30:00Z")), true);
  });

  it("treats a Lisbon winter noon as outside overnight quiet hours", () => {
    assert.equal(isCasaQuietHour(overnight, new Date("2026-01-15T12:00:00Z")), false);
  });
});

describe("selectCasaPushAlerts", () => {
  const quiet = {
    ...DEFAULT_CASA_NOTIFY,
    quietEnabled: true,
    quietStart: "22:00",
    quietEnd: "08:00",
  };
  const night = new Date("2026-01-15T23:30:00Z");

  it("drops everything when push is off", () => {
    assert.equal(selectCasaPushAlerts([{ type: "WATER_LEAK" }], { ...DEFAULT_CASA_NOTIFY, push: false }).length, 0);
  });

  it("honours type prefs and always keeps motion", () => {
    const muted = { ...DEFAULT_CASA_NOTIFY, water: false, battery: false };
    assert.deepEqual(
      selectCasaPushAlerts([{ type: "WATER_LEAK" }, { type: "MOTION" }, { type: "BATTERY" }], muted).map((item) => item.type),
      ["MOTION"],
    );
  });

  it("lets leaks and motion through quiet hours and holds the rest", () => {
    assert.deepEqual(
      selectCasaPushAlerts(
        [{ type: "WATER_LEAK" }, { type: "MOTION" }, { type: "BATTERY" }, { type: "OFFLINE" }],
        quiet,
        night,
      ).map((item) => item.type),
      ["WATER_LEAK", "MOTION"],
    );
  });
});
