import type { CasaDayMark } from "@/lib/casa-day"

export const CASA_DAY_MS = 24 * 3_600_000

/**
 * Two events a few minutes apart cannot be drawn as separate beads on a phone, so anything
 * closer than this share of the day is gathered into one bead that spans their range.
 */
export const CASA_BEAD_GAP = 0.03

export type CasaRibbonBead = {
  id: string
  /** Left edge as a share of the day, 0 at midnight. */
  start: number
  /** Width as a share of the day. Zero for a single moment. */
  span: number
  marks: CasaDayMark[]
  /** The worst thing in the bead decides its colour. */
  tone: "warn" | "alert"
  /** True while anything in the bead is still unresolved. */
  open: boolean
}

/** Where a moment sits on the fixed midnight-to-midnight scale, clamped to 0..1. */
export function casaDayFraction(at: number, dayStart: number) {
  return Math.min(1, Math.max(0, (at - dayStart) / CASA_DAY_MS))
}

export function casaRibbonBeads(
  marks: CasaDayMark[],
  dayStart: number,
  gap = CASA_BEAD_GAP,
): CasaRibbonBead[] {
  const ordered = [...marks].sort((left, right) => left.at - right.at)
  const beads: CasaRibbonBead[] = []

  for (const mark of ordered) {
    const at = casaDayFraction(mark.at, dayStart)
    const last = beads[beads.length - 1]
    if (last && at - (last.start + last.span) <= gap) {
      last.span = at - last.start
      last.marks.push(mark)
      if (mark.tone === "alert") last.tone = "alert"
      if (mark.open) last.open = true
      continue
    }
    beads.push({ id: mark.id, start: at, span: 0, marks: [mark], tone: mark.tone, open: mark.open })
  }

  return beads
}

/** The bead's headline is the thing that most deserves attention, not simply the first. */
export function casaBeadLead(bead: CasaRibbonBead): CasaDayMark {
  return (
    bead.marks.find((mark) => mark.open && mark.tone === "alert") ??
    bead.marks.find((mark) => mark.tone === "alert") ??
    bead.marks.find((mark) => mark.open) ??
    bead.marks[0]
  )
}
