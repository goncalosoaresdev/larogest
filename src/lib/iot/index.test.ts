import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IoTProvider } from "@prisma/client";
import { getIoTAdapter, listIoTAdapters, parseIoTProvider } from "./index";

describe("parseIoTProvider", () => {
  it("returns TUYA for known and unknown values", () => {
    assert.equal(parseIoTProvider("TUYA"), IoTProvider.TUYA);
    assert.equal(parseIoTProvider(" tuya "), IoTProvider.TUYA);
    assert.equal(parseIoTProvider("unknown"), IoTProvider.TUYA);
    assert.equal(parseIoTProvider(null), IoTProvider.TUYA);
  });
});

describe("getIoTAdapter", () => {
  it("returns the registered Tuya adapter", () => {
    const adapter = getIoTAdapter(IoTProvider.TUYA);
    assert.equal(adapter.meta.id, IoTProvider.TUYA);
    assert.ok(adapter.meta.label.length > 0);
  });
});

describe("listIoTAdapters", () => {
  it("lists every registered adapter", () => {
    const adapters = listIoTAdapters();
    assert.equal(adapters.length, 1);
    assert.equal(adapters[0].meta.id, IoTProvider.TUYA);
  });
});
