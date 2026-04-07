/**
 * Time formatting helpers for glasses display.
 * Same pattern as SubwayLens — "N min - H:MM" with hyphen
 * (em dash U+2014 is missing from G2 firmware font).
 */

/**
 * Format an arrival as "N min - H:MM".
 * Returns "now - H:MM" if less than 1 minute away.
 */
export function formatArrival(arrivalTime: number, now?: number): string {
  const currentTime = now ?? Math.floor(Date.now() / 1000)
  const diffSec = arrivalTime - currentTime
  const mins = Math.max(0, Math.round(diffSec / 60))

  const date = new Date(arrivalTime * 1000)
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const hour12 = h % 12 || 12
  const clock = `${hour12}:${m}`

  if (mins === 0) return `now - ${clock}`
  return `${mins} min - ${clock}`
}

/** Get minutes until arrival. */
export function minutesUntil(arrivalTime: number, now?: number): number {
  const currentTime = now ?? Math.floor(Date.now() / 1000)
  return Math.max(0, Math.round((arrivalTime - currentTime) / 60))
}

/** Check if arriving soon (< 4 minutes). */
export function isArrivingSoon(arrivalTime: number, now?: number): boolean {
  return minutesUntil(arrivalTime, now) < 4
}
