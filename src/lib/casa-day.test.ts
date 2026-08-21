import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PulseAlertType, PulseSample } from "@prisma/client";
import { buildCasaDay, casaAlertReadout, dayTicks, humidityAt, startOfLisbonDay } from "./casa-day";
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

describe("dayTicks", () => {
  const midnight = startOfLisbonDay(new Date("2026-08-21T10:00:00Z")).getTime();
  const hour = 3_600_000;
  const at = (hours: number) => ({ at: midnight + hours * hour });

  it("labels each alert and ends on now", () => {
    const ticks = dayTicks([at(8), at(11)], midnight + 13 * hour + 52 * 60_000);
    assert.deepEqual(
      ticks.map((tick) => tick.label),
      ["08:00", "11:00", "13:52"],
    );
    assert.equal(ticks[ticks.length - 1].now, true);
  });

  it("is only now when nothing has happened yet", () => {
    const ticks = dayTicks([], midnight + 13 * hour + 52 * 60_000);
    assert.deepEqual(
      ticks.map((tick) => tick.label),
      ["13:52"],
    );
    assert.equal(ticks[0].now, true);
  });

  it("keeps one label when two alerts would sit on top of each other", () => {
    const labels = dayTicks([at(8), at(8.5)], midnight + 13 * hour).map((tick) => tick.label);
    assert.deepEqual(labels, ["08:00", "13:00"]);
  });

  it("drops an alert that would sit on now", () => {
    const labels = dayTicks([at(13)], midnight + 13 * hour + 20 * 60_000).map((tick) => tick.label);
    assert.deepEqual(labels, ["13:20"]);
  });

  it("never invents a clock time that is not an alert or now", () => {
    const labels = dayTicks([at(9)], midnight + 13 * hour + 52 * 60_000).map((tick) => tick.label);
    assert.equal(labels.includes("00:00"), false);
    assert.equal(labels.includes("06:00"), false);
    assert.equal(labels.includes("18:00"), false);
    assert.deepEqual(labels, ["09:00", "13:52"]);
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
    const leak = day.marks.find((mark) => mark.id === "leak");
    assert.equal(leak?.tone, "alert");
    assert.equal(leak?.open, true);
    assert.equal(leak?.alertType, "WATER_LEAK");
    assert.equal(day.marks.some((mark) => mark.id === "old"), false);
    assert.ok(day.ticks.some((tick) => tick.now));
    assert.equal(day.to, now.getTime());
  });

  it("reads severity from the alert type and keeps open separate from resolved", () => {
    const now = new Date("2026-01-15T15:00:00Z");
    const day = buildCasaDay({
      devices: [],
      alerts: [
        { id: "old-leak", type: "WATER_LEAK", status: "RESOLVED", triggeredAt: new Date("2026-01-15T09:00:00Z") },
        { id: "motion", type: "MOTION", status: "OPEN", triggeredAt: new Date("2026-01-15T14:00:00Z") },
      ],
      now,
      locale: "pt",
    });
    const mark = (id: string) => day.marks.find((item) => item.id === id);
    // A resolved leak is still the serious kind of event; an open motion alert is not.
    assert.equal(mark("old-leak")?.tone, "alert");
    assert.equal(mark("old-leak")?.open, false);
    assert.equal(mark("motion")?.tone, "warn");
    assert.equal(mark("motion")?.open, true);
  });

  it("returns marks in the order they happened", () => {
    const now = new Date("2026-01-15T15:00:00Z");
    const day = buildCasaDay({
      devices: [],
      alerts: [
        { id: "late", type: "MOTION", status: "RESOLVED", triggeredAt: new Date("2026-01-15T14:00:00Z") },
        { id: "early", type: "MOTION", status: "RESOLVED", triggeredAt: new Date("2026-01-15T08:00:00Z") },
      ],
      now,
      locale: "pt",
    });
    assert.deepEqual(
      day.marks.map((mark) => mark.id),
      ["early", "late"],
    );
  });

  it("attaches the matching reading for every alert type", () => {
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
    const water: CasaOwnerDevice = {
      id: "water-1",
      kind: "WATER",
      label: "Cozinha",
      online: true,
      lastSeenAt: now.toISOString(),
      batteryPct: 12,
      reading: { leak: false },
    };
    const noon = new Date("2026-01-15T12:00:00Z");
    const two = new Date("2026-01-15T14:00:00Z");
    const day = buildCasaDay({
      devices: [climate, water],
      alerts: [
        { id: "hum", type: "HUMIDITY_HIGH", status: "OPEN", triggeredAt: noon, deviceId: climate.id },
        { id: "cold", type: "TEMP_LOW", status: "OPEN", triggeredAt: noon, deviceId: climate.id },
        { id: "hot", type: "TEMP_HIGH", status: "OPEN", triggeredAt: two, deviceId: climate.id },
        { id: "bat", type: "BATTERY", status: "OPEN", triggeredAt: noon, deviceId: water.id },
        { id: "leak", type: "WATER_LEAK", status: "OPEN", triggeredAt: two, deviceId: water.id },
        { id: "motion", type: "MOTION", status: "OPEN", triggeredAt: two },
        { id: "door", type: "DOOR_OPEN", status: "OPEN", triggeredAt: two },
        { id: "off", type: "OFFLINE", status: "OPEN", triggeredAt: two },
      ],
      samples: [
        sample({ id: "c-noon", deviceId: climate.id, recordedAt: noon, humidity: 81, temperature: 9 }),
        sample({ id: "c-two", deviceId: climate.id, recordedAt: two, humidity: 60, temperature: 33.4 }),
        sample({ id: "w-noon", deviceId: water.id, recordedAt: noon, batteryPct: 12 }),
      ],
      now,
      locale: "pt",
    });
    const mark = (id: string) => day.marks.find((item) => item.id === id);
    assert.deepEqual(mark("hum")?.readout, { kind: "humidity", value: 81 });
    assert.deepEqual(mark("cold")?.readout, { kind: "temperature", value: 9 });
    assert.deepEqual(mark("hot")?.readout, { kind: "temperature", value: 33.4 });
    assert.deepEqual(mark("bat")?.readout, { kind: "battery", value: 12 });
    assert.equal(mark("leak")?.readout, undefined);
    assert.equal(mark("motion")?.readout, undefined);
    assert.equal(mark("door")?.readout, undefined);
    assert.equal(mark("off")?.readout, undefined);
  });
});

describe("casaAlertReadout", () => {
  it("maps every Pulse alert type to a reading or to none", () => {
    const values = { humidity: 82, temperature: 8.4, batteryPct: 12 };
    const expected: Record<PulseAlertType, ReturnType<typeof casaAlertReadout>> = {
      HUMIDITY_HIGH: { kind: "humidity", value: 82 },
      TEMP_HIGH: { kind: "temperature", value: 8.4 },
      TEMP_LOW: { kind: "temperature", value: 8.4 },
      BATTERY: { kind: "battery", value: 12 },
      WATER_LEAK: undefined,
      DOOR_OPEN: undefined,
      MOTION: undefined,
      OFFLINE: undefined,
    };
    for (const type of Object.keys(expected) as PulseAlertType[]) {
      assert.deepEqual(casaAlertReadout(type, values), expected[type]);
    }
  });
});

function sample(
  partial: Partial<PulseSample> & Pick<PulseSample, "id" | "deviceId" | "recordedAt">,
): PulseSample {
  return {
    temperature: null,
    humidity: null,
    leak: null,
    open: null,
    motion: null,
    lux: null,
    batteryPct: null,
    online: true,
    ...partial,
  };
}
