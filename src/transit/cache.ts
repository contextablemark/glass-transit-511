/**
 * Per-agency feed cache with TTL.
 *
 * Caches decoded GTFS-RT entities per agency so that switching between
 * stations on the same agency doesn't trigger a new fetch.
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity

interface CacheEntry {
  entities: FeedEntity[]
  fetchedAt: number // Date.now() ms
}

const cache = new Map<string, CacheEntry>()

/** Get cached entities for an agency if not expired. */
export function getCached(
  agency: string,
  maxAgeMs: number
): FeedEntity[] | null {
  const entry = cache.get(agency)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > maxAgeMs) return null
  return entry.entities
}

/** Store entities for an agency. */
export function setCached(agency: string, entities: FeedEntity[]): void {
  cache.set(agency, { entities, fetchedAt: Date.now() })
}

/** Clear all cached entries. */
export function clearCache(): void {
  cache.clear()
}

/** Check if a cached entry exists and is fresh. */
export function isFresh(agency: string, maxAgeMs: number): boolean {
  return getCached(agency, maxAgeMs) !== null
}
