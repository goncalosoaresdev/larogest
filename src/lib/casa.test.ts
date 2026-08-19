import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PulseAlert, PulseDevice } from "@prisma/client";
import { casaHouseName, toCasaOwnerAlert, toCasaOwnerDevice } from "./casa";

describe("casaHouseName", () => {
  it("prefers the city, then the address, then the fallback", () => {
    assert.equal(casaHouseName("Porto", "Rua A"), "Casa de Porto");
    assert.equal(casaHouseName(null, "Rua das Flores"), "Rua das Flores");
    assert.equal(casaHouseName(null, ""), "A sua casa");
  });
});

describe("toCasaOwnerDevice", () => {
  it("parses the last payload and ISO-encodes lastSeenAt", () => {
    const seen = new Date("2026-01-15T12:00:00.000Z");
    const row = {
      id: "d1",
      siteId: "s1",
      kind: "WATER" as const,
      label: "Cozinha",
      model: "Leak",
      providerDeviceId: null,
      online: true,
      lastSeenAt: seen,
      batteryPct: 40,
      lastPayload: { leak: true },
      createdAt: seen,
      updatedAt: seen,
    } satisfies PulseDevice;
    const device = toCasaOwnerDevice(row);
    assert.equal(device.id, "d1");
    assert.equal(device.reading.leak, true);
    assert.equal(device.lastSeenAt, seen.toISOString());
    assert.equal(toCasaOwnerDevice({ ...row, lastSeenAt: null, lastPayload: null }).lastSeenAt, null);
  });
});

describe("toCasaOwnerAlert", () => {
  it("keeps type and ISO-encodes the trigger time", () => {
    const triggeredAt = new Date("2026-01-15T14:00:00.000Z");
    const alert = toCasaOwnerAlert({
      id: "a1",
      siteId: "s1",
      deviceId: null,
      type: "WATER_LEAK",
      status: "OPEN",
      message: "Fuga",
      triggeredAt,
      resolvedAt: null,
    } satisfies PulseAlert);
    assert.equal(alert.type, "WATER_LEAK");
    assert.equal(alert.triggeredAt, triggeredAt.toISOString());
    assert.equal(alert.message, "Fuga");
  });
});
