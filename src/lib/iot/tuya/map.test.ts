import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pulseKindFromTuya, readingFromTuyaStatus, toProviderDevice } from "./map";

describe("readingFromTuyaStatus", () => {
  it("maps leak, scaled temperature, humidity over 100, and battery state", () => {
    const { reading, batteryPct } = readingFromTuyaStatus([
      { code: "watersensor_state", value: "leak" },
      { code: "va_temperature", value: 215 },
      { code: "humidity_value", value: 550 },
      { code: "battery_state", value: "low" },
    ]);
    assert.equal(reading.leak, true);
    assert.equal(reading.temperature, 21.5);
    assert.equal(reading.humidity, 55);
    assert.equal(batteryPct, 10);
  });

  it("maps door, motion, and lux codes", () => {
    const { reading } = readingFromTuyaStatus([
      { code: "doorcontact_state", value: "open" },
      { code: "pir_state", value: "small_move" },
      { code: "illuminance_lux", value: 42 },
    ]);
    assert.equal(reading.open, true);
    assert.equal(reading.motion, true);
    assert.equal(reading.lux, 42);
  });
});

describe("pulseKindFromTuya", () => {
  it("classifies from status codes first, then category names", () => {
    assert.equal(pulseKindFromTuya({ status: [{ code: "watersensor_state" }] }), "WATER");
    assert.equal(pulseKindFromTuya({ status: [{ code: "pir" }] }), "MOTION");
    assert.equal(pulseKindFromTuya({ category: "mcs" }), "DOOR");
    assert.equal(pulseKindFromTuya({ category: "wsdcg" }), "TEMP_HUMIDITY");
    assert.equal(pulseKindFromTuya({ name: "Hub", sub: false }), "GATEWAY");
    assert.equal(pulseKindFromTuya({ name: "Unknown" }), "OTHER");
  });
});

describe("toProviderDevice", () => {
  it("returns null without an id and otherwise maps a leak sensor", () => {
    assert.equal(toProviderDevice({ name: "sem id" }), null);
    const device = toProviderDevice({
      id: "tuy-1",
      name: " Fuga cozinha ",
      product_name: "Water",
      online: true,
      owner_id: "home-1",
      status: [{ code: "watersensor_state", value: "wet" }],
    });
    assert.equal(device?.id, "tuy-1");
    assert.equal(device?.name, "Fuga cozinha");
    assert.equal(device?.kind, "WATER");
    assert.equal(device?.reading.leak, true);
    assert.equal(device?.locationId, "home-1");
    assert.equal(device?.online, true);
  });
});
