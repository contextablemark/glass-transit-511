/**
 * Sliding-window rate limiter for 511.org API requests.
 *
 * 511.org allows 60 requests per hour per API key (default).
 * We track request timestamps in a sliding 60-minute window
 * and pause fetching when approaching the limit.
 */

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_LIMIT = 60
const BUFFER = 2 // stop 2 requests before hard limit

let timestamps: number[] = []

/** Record a request. */
export function recordRequest(): void {
  timestamps.push(Date.now())
}

/** Prune timestamps older than the window. */
function prune(): void {
  const cutoff = Date.now() - WINDOW_MS
  timestamps = timestamps.filter((t) => t > cutoff)
}

/** Check if a request can be made without exceeding the rate limit. */
export function canFetch(limit = DEFAULT_LIMIT): boolean {
  prune()
  return timestamps.length < limit - BUFFER
}

/** Get the number of requests remaining in the current window. */
export function requestsRemaining(limit = DEFAULT_LIMIT): number {
  prune()
  return Math.max(0, limit - timestamps.length)
}

/** Get the number of requests made in the current window. */
export function requestsMade(): number {
  prune()
  return timestamps.length
}

/** Reset the rate limiter (e.g. on app restart). */
export function resetRateLimiter(): void {
  timestamps = []
}
