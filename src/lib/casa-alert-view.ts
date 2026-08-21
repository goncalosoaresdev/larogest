import type { PulseAlertType } from "@prisma/client"
import { pulseAlertUrgency } from "@/lib/pulse-alerts"

export type CasaAlertTone = "alert" | "warn"

/** Water is the only owner alert that damages the house on its own, so it is the only one that shouts. */
export function casaAlertTone(type: PulseAlertType): CasaAlertTone {
  return type === "WATER_LEAK" ? "alert" : "warn"
}

/** Open alerts read worst-first: a leak outranks a flat battery even when the battery fired later. */
export function sortCasaOpenAlerts<T extends { type: PulseAlertType; triggeredAt: string }>(alerts: T[]): T[] {
  return [...alerts].sort((left, right) => {
    const urgency = pulseAlertUrgency(left.type) - pulseAlertUrgency(right.type)
    if (urgency !== 0) return urgency
    if (left.triggeredAt === right.triggeredAt) return 0
    return left.triggeredAt < right.triggeredAt ? 1 : -1
  })
}

/**
 * The sensor behind an alert. History keeps alerts for a month, so the device may be gone
 * or may be a gateway the owner never sees; both resolve to null and the row drops the line.
 */
export function casaAlertDevice<T extends { id: string }>(deviceId: string | null, devices: T[]): T | null {
  if (!deviceId) return null
  return devices.find((device) => device.id === deviceId) ?? null
}
