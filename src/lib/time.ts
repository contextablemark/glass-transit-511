/**
 * Time formatting helpers for glasses display.
 * Compact format: "Nm" or "now".
 */

/**
 * Format an arrival compactly: "5m", "now".
 */
export function formatArrival(arrivalTime: number, now?: number): string {
  const mins = minutesUntil(arrivalTime, now)
  if (mins === 0) return 'now'
  return `${mins}m`
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
