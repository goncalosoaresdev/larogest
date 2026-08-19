import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCasaDay, humidityAt, smoothPath, startOfLisbonDay } from "./casa-day";
import type { CasaOwnerDevice } from "./casa";

describe("humidityAt", () => {
  it("interpolates between samples and clamps outside the range", () => {
    const points = [
      { at: 0, humidity: 40 },
      { at: 100, humidity: 60 },
    ];
    assert.equal(humidityAt([], 50), null);
    assert.equal(humidityAt(points, -10), 40);
    assert.equal(humidityAt(points, 200), 60);
    assert.equal(humidityAt(points, 50), 50);
  });
});

describe("smoothPath", () => {
  it("builds SVG path commands for 0, 1, 2, and many points", () => {
    assert.equal(smoothPath([]), "");
    assert.equal(smoothPath([{ x: 1, y: 2 }]), "M1.00 2.00");
    assert.equal(smoothPath([{ x: 0, y: 0 }, { x: 4, y: 4 }]), "M0.00 0.00 L4.00 4.00");
    const curve = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ]);
    assert.match(curve, /^M0\.00 0\.00/);
    assert.match(curve, /C/);
  });
});

describe("startOfLisbonDay", () => {
  it("returns midnight in Europe/Lisbon for a winter morning", () => {
    const start = startOfLisbonDay(new Date("2026-01-15T10:30:00Z"));
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(start);
    assert.equal(hour, "00:00");
    assert.ok(start.getTime() <= Date.parse("2026-01-15T10:30:00Z"));
  });
});

describe("buildCasaDay", () => {
  it("includes today's humidity, a now mark, and filters old alerts", () => {
    const now = new Date("2026-01-15T15:00:00Z");
    const climate: CasaOwnerDevice = {
      id: "climate-1",
      kind: "TEMP_HUMIDITY",
      label: "Clima",
      online: true,
      lastSeenAt: now.toISOString(),
      batteryPct: 80,
      reading: { humidity: 55, temperature: 21 },
    };
    const day = buildCasaDay({
      devices: [climate],
      alerts: [
        {
          id: "old",
          type: "WATER_LEAK",
          status: "OPEN",
          triggeredAt: new Date("2026-01-14T10:00:00Z"),
        },
        {
          id: "leak",
          type: "WATER_LEAK",
          status: "OPEN",
          triggeredAt: new Date("2026-01-15T14:00:00Z"),
        },
      ],
      now,
      locale: "pt",
    });
    assert.equal(day.humidity, 55);
    assert.ok(day.points.length >= 1);
    assert.ok(day.marks.some((mark) => mark.id === "now" && mark.kind === "now"));
    assert.ok(day.marks.some((mark) => mark.id === "leak" && mark.tone === "alert"));
    assert.equal(day.marks.some((mark) => mark.id === "old"), false);
    assert.ok(day.ticks.some((tick) => tick.now));
  });
});
