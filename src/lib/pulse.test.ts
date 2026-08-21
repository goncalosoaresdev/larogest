import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PulseDevice } from "@prisma/client";
import {
  formatPulseHeadline,
  isPulseSiteActive,
  parsePulsePayload,
  pulseDeviceSeverity,
  pulseHouseHeadline,
  sortPulseDevices,
} from "./pulse";

function device(overrides: Partial<PulseDevice> = {}): PulseDevice {
  return {
    id: "d1",
    siteId: "s1",
    kind: "WATER",
    label: "Cozinha",
    model: "Leak",
    providerDeviceId: "ext",
    online: true,
    lastSeenAt: new Date("2026-01-15T12:00:00Z"),
    batteryPct: 80,
    lastPayload: { leak: false },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-15T12:00:00Z"),
    ...overrides,
  };
}

describe("isPulseSiteActive", () => {
  it("treats only DISABLED as inactive", () => {
    assert.equal(isPulseSiteActive("ACTIVE"), true);
    assert.equal(isPulseSiteActive("PAUSED"), true);
    assert.equal(isPulseSiteActive("DISABLED"), false);
  });
});

describe("parsePulsePayload", () => {
  it("keeps only typed reading fields", () => {
    assert.deepEqual(parsePulsePayload(null), {});
    assert.deepEqual(parsePulsePayload([]), {});
    assert.deepEqual(
      parsePulsePayload({ leak: true, temperature: 21.4, extra: "nope", humidity: "55", lastMotionAt: "2026-08-21T11:40:00.000Z" }),
      { leak: true, temperature: 21.4, open: undefined, humidity: undefined, motion: undefined, lux: undefined },
    );
  });
});

describe("formatPulseHeadline", () => {
  it("describes leak, climate, and offline devices", () => {
    assert.equal(formatPulseHeadline(device({ lastPayload: { leak: true } })), "Fuga detectada");
    assert.equal(formatPulseHeadline(device({ lastPayload: { leak: false } })), "Seco");
    assert.equal(
      formatPulseHeadline(
        device({
          kind: "TEMP_HUMIDITY",
          lastPayload: { temperature: 21, humidity: 55 },
        }),
      ),
      `${(21).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} °C · ${(55).toLocaleString("pt-PT", { maximumFractionDigits: 0 })} %`,
    );
    assert.equal(formatPulseHeadline(device({ online: false })), "Offline");
    assert.equal(formatPulseHeadline(device({ online: false, lastSeenAt: null })), "Ainda sem leitura");
    assert.equal(
      formatPulseHeadline(device({ kind: "DOOR", lastPayload: { open: true } })),
      "Aberta",
    );
    assert.equal(
      formatPulseHeadline(device({ kind: "MOTION", lastPayload: { motion: false, lux: 12.2 } })),
      "Calmo · 12 lx",
    );
  });
});

describe("pulseDeviceSeverity", () => {
  it("classifies idle, leak, climate, and battery states", () => {
    assert.equal(pulseDeviceSeverity({ kind: "WATER", online: true, lastSeenAt: null, batteryPct: 80 }), "idle");
    assert.equal(
      pulseDeviceSeverity({
        kind: "WATER",
        online: false,
        lastSeenAt: new Date(),
        batteryPct: 80,
      }),
      "offline",
    );
    assert.equal(
      pulseDeviceSeverity({
        kind: "WATER",
        online: true,
        lastSeenAt: new Date(),
        batteryPct: 80,
        reading: { leak: true },
      }),
      "alert",
    );
    assert.equal(
      pulseDeviceSeverity({
        kind: "TEMP_HUMIDITY",
        online: true,
        lastSeenAt: new Date(),
        batteryPct: 80,
        reading: { temperature: 35 },
      }),
      "warn",
    );
    assert.equal(
      pulseDeviceSeverity({
        kind: "DOOR",
        online: true,
        lastSeenAt: new Date(),
        batteryPct: 10,
        reading: { open: false },
      }),
      "warn",
    );
    assert.equal(
      pulseDeviceSeverity({
        kind: "WATER",
        online: true,
        lastSeenAt: new Date(),
        batteryPct: 80,
        reading: { leak: false },
      }),
      "ok",
    );
  });
});

describe("pulseHouseHeadline", () => {
  it("prefers leaks, then motion, then alert counts", () => {
    assert.equal(
      pulseHouseHeadline(
        [{ kind: "WATER", online: true, lastSeenAt: new Date(), batteryPct: 80, reading: { leak: true } }],
        0,
      ),
      "Fuga de água",
    );
    assert.equal(
      pulseHouseHeadline(
        [{ kind: "MOTION", online: true, lastSeenAt: new Date(), batteryPct: 80, reading: { motion: true } }],
        0,
      ),
      "Movimento detectado",
    );
    assert.equal(pulseHouseHeadline([], 1), "1 alerta aberto");
    assert.equal(pulseHouseHeadline([], 3), "3 alertas abertos");
    assert.equal(pulseHouseHeadline([], 0), "À espera dos sensores");
    assert.equal(
      pulseHouseHeadline(
        [{ kind: "WATER", online: true, lastSeenAt: null, batteryPct: 80 }],
        0,
      ),
      "Ainda sem leitura",
    );
    assert.equal(
      pulseHouseHeadline(
        [{ kind: "WATER", online: true, lastSeenAt: new Date(), batteryPct: 80, reading: { leak: false } }],
        0,
      ),
      "Tudo calmo",
    );
  });
});

describe("sortPulseDevices", () => {
  it("orders by kind then Portuguese label", () => {
    const sorted = sortPulseDevices([
      device({ id: "t", kind: "TEMP_HUMIDITY", label: "Quarto" }),
      device({ id: "w2", kind: "WATER", label: "WC" }),
      device({ id: "w1", kind: "WATER", label: "Cozinha" }),
    ]);
    assert.deepEqual(
      sorted.map((item) => item.id),
      ["w1", "w2", "t"],
    );
  });
});
