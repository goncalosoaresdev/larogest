import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { casaAlertDevice, casaAlertTone, sortCasaOpenAlerts } from "./casa-alert-view"

describe("casaAlertTone", () => {
  it("shouts only for water", () => {
    assert.equal(casaAlertTone("WATER_LEAK"), "alert")
  })

  it("treats every other alert as attention", () => {
    for (const type of ["DOOR_OPEN", "TEMP_HIGH", "TEMP_LOW", "HUMIDITY_HIGH", "MOTION", "BATTERY", "OFFLINE"] as const) {
      assert.equal(casaAlertTone(type), "warn", type)
    }
  })
})

describe("sortCasaOpenAlerts", () => {
  it("puts a leak above an older battery alert", () => {
    const sorted = sortCasaOpenAlerts([
      { type: "BATTERY", triggeredAt: "2026-08-21T10:00:00.000Z" },
      { type: "WATER_LEAK", triggeredAt: "2026-08-21T08:00:00.000Z" },
    ])
    assert.deepEqual(
      sorted.map((item) => item.type),
      ["WATER_LEAK", "BATTERY"],
    )
  })

  it("orders equally urgent alerts most recent first", () => {
    const sorted = sortCasaOpenAlerts([
      { type: "TEMP_LOW", triggeredAt: "2026-08-21T08:00:00.000Z" },
      { type: "HUMIDITY_HIGH", triggeredAt: "2026-08-21T11:00:00.000Z" },
      { type: "TEMP_HIGH", triggeredAt: "2026-08-21T09:30:00.000Z" },
    ])
    assert.deepEqual(
      sorted.map((item) => item.triggeredAt),
      ["2026-08-21T11:00:00.000Z", "2026-08-21T09:30:00.000Z", "2026-08-21T08:00:00.000Z"],
    )
  })

  it("ranks the full urgency ladder", () => {
    const sorted = sortCasaOpenAlerts([
      { type: "MOTION", triggeredAt: "2026-08-21T10:00:00.000Z" },
      { type: "TEMP_HIGH", triggeredAt: "2026-08-21T10:00:00.000Z" },
      { type: "BATTERY", triggeredAt: "2026-08-21T10:00:00.000Z" },
      { type: "OFFLINE", triggeredAt: "2026-08-21T10:00:00.000Z" },
      { type: "WATER_LEAK", triggeredAt: "2026-08-21T10:00:00.000Z" },
    ])
    assert.deepEqual(
      sorted.map((item) => item.type),
      ["WATER_LEAK", "OFFLINE", "BATTERY", "TEMP_HIGH", "MOTION"],
    )
  })

  it("leaves the input array untouched", () => {
    const input = [
      { type: "BATTERY" as const, triggeredAt: "2026-08-21T10:00:00.000Z" },
      { type: "WATER_LEAK" as const, triggeredAt: "2026-08-21T08:00:00.000Z" },
    ]
    sortCasaOpenAlerts(input)
    assert.deepEqual(
      input.map((item) => item.type),
      ["BATTERY", "WATER_LEAK"],
    )
  })
})

describe("casaAlertDevice", () => {
  const devices = [{ id: "kitchen" }, { id: "hall" }]

  it("finds the sensor behind the alert", () => {
    assert.deepEqual(casaAlertDevice("hall", devices), { id: "hall" })
  })

  it("returns null for an alert with no device", () => {
    assert.equal(casaAlertDevice(null, devices), null)
  })

  it("returns null when the sensor is no longer listed", () => {
    assert.equal(casaAlertDevice("garage", devices), null)
  })
})
