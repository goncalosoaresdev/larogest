import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CASA_NOTIFY,
  allowCasaNotify,
  isCasaQuietHour,
  parseClockMinutes,
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

describe("allowCasaNotify", () => {
  it("honours per-type prefs and always allows motion", () => {
    const muted = { ...DEFAULT_CASA_NOTIFY, water: false, climate: false };
    assert.equal(allowCasaNotify(muted, "WATER_LEAK"), false);
    assert.equal(allowCasaNotify(muted, "MOTION"), true);
    assert.equal(allowCasaNotify(muted, "TEMP_HIGH"), false);
    assert.equal(allowCasaNotify(DEFAULT_CASA_NOTIFY, "OFFLINE"), true);
    assert.equal(allowCasaNotify(DEFAULT_CASA_NOTIFY, "DOOR_OPEN"), false);
  });
});
