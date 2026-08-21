import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CASA_DAY_MS, casaBeadLead, casaDayFraction, casaRibbonBeads } from "./casa-ribbon"
import type { CasaDayMark } from "./casa-day"

const MIDNIGHT = Date.parse("2026-08-21T00:00:00Z")
const HOUR = 3_600_000

function mark(id: string, hours: number, extra: Partial<CasaDayMark> = {}): CasaDayMark {
  return {
    id,
    at: MIDNIGHT + hours * HOUR,
    label: id,
    detail: "aberto",
    tone: "warn",
    open: false,
    alertType: "MOTION",
    ...extra,
  }
}

describe("casaDayFraction", () => {
  it("maps midnight, midday and the end of the day onto 0, 0.5 and 1", () => {
    assert.equal(casaDayFraction(MIDNIGHT, MIDNIGHT), 0)
    assert.equal(casaDayFraction(MIDNIGHT + 12 * HOUR, MIDNIGHT), 0.5)
    assert.equal(casaDayFraction(MIDNIGHT + CASA_DAY_MS, MIDNIGHT), 1)
  })

  it("clamps moments outside the day", () => {
    assert.equal(casaDayFraction(MIDNIGHT - HOUR, MIDNIGHT), 0)
    assert.equal(casaDayFraction(MIDNIGHT + 30 * HOUR, MIDNIGHT), 1)
  })
})

describe("casaRibbonBeads", () => {
  it("keeps well separated events as their own beads with no span", () => {
    const beads = casaRibbonBeads([mark("a", 3), mark("b", 15)], MIDNIGHT)
    assert.equal(beads.length, 2)
    assert.equal(beads[0].span, 0)
    assert.equal(beads[1].span, 0)
    assert.equal(beads[0].start, 3 / 24)
  })

  it("gathers a burst into one bead that spans the burst", () => {
    const beads = casaRibbonBeads([mark("a", 8), mark("b", 8.2), mark("c", 8.4)], MIDNIGHT)
    assert.equal(beads.length, 1)
    assert.equal(beads[0].marks.length, 3)
    assert.equal(beads[0].start, 8 / 24)
    assert.ok(Math.abs(beads[0].span - 0.4 / 24) < 1e-9)
  })

  it("orders unsorted input before binning", () => {
    const beads = casaRibbonBeads([mark("late", 20), mark("early", 2)], MIDNIGHT)
    assert.deepEqual(
      beads.map((bead) => bead.marks[0].id),
      ["early", "late"],
    )
  })

  it("lets the worst member set the bead tone and keeps it open while anything is open", () => {
    const beads = casaRibbonBeads(
      [mark("motion", 9), mark("leak", 9.1, { tone: "alert", open: true, alertType: "WATER_LEAK" })],
      MIDNIGHT,
    )
    assert.equal(beads.length, 1)
    assert.equal(beads[0].tone, "alert")
    assert.equal(beads[0].open, true)
  })

  it("stays resolved when every member is resolved", () => {
    const beads = casaRibbonBeads([mark("a", 9), mark("b", 9.1)], MIDNIGHT)
    assert.equal(beads[0].open, false)
    assert.equal(beads[0].tone, "warn")
  })

  it("splits a long drizzle of events instead of merging the whole day", () => {
    const spread = [mark("a", 1), mark("b", 6), mark("c", 12), mark("d", 18)]
    assert.equal(casaRibbonBeads(spread, MIDNIGHT).length, 4)
  })

  it("chains events that each fall inside the gap of the previous one", () => {
    // 0.03 of a day is ~43 minutes, so half-hour steps keep extending the same bead.
    const beads = casaRibbonBeads([mark("a", 8), mark("b", 8.5), mark("c", 9), mark("d", 9.5)], MIDNIGHT)
    assert.equal(beads.length, 1)
    assert.ok(Math.abs(beads[0].span - 1.5 / 24) < 1e-9)
  })

  it("returns nothing for a day with no events", () => {
    assert.deepEqual(casaRibbonBeads([], MIDNIGHT), [])
  })
})

describe("casaBeadLead", () => {
  it("prefers an open alert over a resolved one", () => {
    const bead = casaRibbonBeads(
      [
        mark("resolved-leak", 9, { tone: "alert", alertType: "WATER_LEAK" }),
        mark("open-leak", 9.1, { tone: "alert", open: true, alertType: "WATER_LEAK" }),
      ],
      MIDNIGHT,
    )[0]
    assert.equal(casaBeadLead(bead).id, "open-leak")
  })

  it("prefers an alert over an open warning", () => {
    const bead = casaRibbonBeads(
      [mark("open-motion", 9, { open: true }), mark("leak", 9.1, { tone: "alert", alertType: "WATER_LEAK" })],
      MIDNIGHT,
    )[0]
    assert.equal(casaBeadLead(bead).id, "leak")
  })

  it("falls back to the only event in a quiet bead", () => {
    const bead = casaRibbonBeads([mark("solo", 9)], MIDNIGHT)[0]
    assert.equal(casaBeadLead(bead).id, "solo")
  })
})
