/**
 * Station manager — manages the active station list (favorites)
 * and coordinates feed fetching + arrival extraction.
 *
 * Adapted from SubwayLens stations.ts — simplified (no GPS nearby).
 */

import stationsData from '../data/stations.json'
import type { Station, StationArrivals, Settings } from '../types'
import { getFavorites } from '../lib/storage'
import { fetchAllFeeds, getStationArrivals } from '../transit/feeds'
import { getCached, setCached } from '../transit/cache'
import { canFetch, recordRequest } from '../transit/rate-limiter'
import { agenciesForStations } from '../data/feed-urls'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity

const allStations = stationsData as Station[]
const stationById = new Map(allStations.map((s) => [s.id, s]))

interface StationManagerState {
  stations: Station[]
  currentIndex: number
  feedMap: Map<string, FeedEntity[]>
}

const state: StationManagerState = {
  stations: [],
  currentIndex: 0,
  feedMap: new Map(),
}

/** Load stations from storage (favorites only). */
export async function loadStations(): Promise<void> {
  const favIds = await getFavorites()
  const favStations: Station[] = []
  for (const id of favIds) {
    const s = stationById.get(id)
    if (s) favStations.push(s)
  }
  state.stations = favStations

  // Clamp index
  if (state.currentIndex >= state.stations.length) {
    state.currentIndex = Math.max(0, state.stations.length - 1)
  }
}

/** Get current station or null if none. */
export function currentStation(): Station | null {
  return state.stations[state.currentIndex] ?? null
}

/** Navigate to next station (wraps). */
export function nextStation(): void {
  if (state.stations.length === 0) return
  state.currentIndex =
    (state.currentIndex + 1) % state.stations.length
}

/** Navigate to previous station (wraps). */
export function prevStation(): void {
  if (state.stations.length === 0) return
  state.currentIndex =
    (state.currentIndex - 1 + state.stations.length) % state.stations.length
}

/** Check if a station is in the favorites list. */
export function isFavorite(stationId: string): boolean {
  return state.stations.some((s) => s.id === stationId)
}

/** Get current state (for display rendering). */
export function getState(): {
  stations: Station[]
  currentIndex: number
} {
  return { stations: state.stations, currentIndex: state.currentIndex }
}

/**
 * Refresh arrivals for the current station.
 * Fetches feeds for agencies that need refreshing, caches results.
 */
export async function refreshCurrentArrivals(
  settings: Settings
): Promise<StationArrivals | null> {
  const station = currentStation()
  if (!station) return null

  const maxAgeMs = settings.refreshInterval * 1000

  // Check if we have fresh cached data
  const cached = getCached(station.agency, maxAgeMs)
  if (cached) {
    state.feedMap.set(station.agency, cached)
    return getStationArrivals(station, state.feedMap)
  }

  // Need to fetch — check rate limit
  if (!canFetch()) {
    console.warn('Rate limit reached, using stale cache if available')
    const stale = getCached(station.agency, Infinity)
    if (stale) {
      state.feedMap.set(station.agency, stale)
      return getStationArrivals(station, state.feedMap)
    }
    return {
      stationId: station.id,
      north: [],
      south: [],
      fetchedAt: Math.floor(Date.now() / 1000),
    }
  }

  // Fetch feeds for all agencies that have saved stations
  const agencies = agenciesForStations(state.stations)
  const staleAgencies = agencies.filter((a) => !getCached(a, maxAgeMs))

  for (const agency of staleAgencies) {
    recordRequest()
  }

  try {
    const freshFeeds = await fetchAllFeeds(
      settings,
      state.stations.filter((s) =>
        staleAgencies.includes(s.agency)
      )
    )

    for (const [agency, entities] of freshFeeds) {
      setCached(agency, entities)
      state.feedMap.set(agency, entities)
    }
  } catch (err) {
    console.error('Feed fetch failed:', err)
  }

  return getStationArrivals(station, state.feedMap)
}
