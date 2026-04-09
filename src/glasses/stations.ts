/**
 * Station manager — manages per-platform favorite pages.
 *
 * For BART stations: tries legacy API first (richer data), falls back to GTFS-RT.
 * For Muni stations: uses GTFS-RT via proxy.
 */

import stationsData from '../data/stations.json'
import type { Station, StationArrivals, Settings, FavoriteEntry } from '../types'
import { getFavorites } from '../lib/storage'
import { fetchBartArrivals } from '../transit/bart-api'
import { fetchAllFeeds, getStationArrivals } from '../transit/feeds'
import { getCached, setCached } from '../transit/cache'
import { canFetch, recordRequest } from '../transit/rate-limiter'
import { agenciesForStations } from '../data/feed-urls'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity

const allStations = stationsData as unknown as Station[]
const stationById = new Map(allStations.map((s) => [s.id, s]))

export interface Page {
  station: Station
  platform: number
}

interface StationManagerState {
  pages: Page[]
  currentIndex: number
  feedMap: Map<string, FeedEntity[]>
}

const state: StationManagerState = {
  pages: [],
  currentIndex: 0,
  feedMap: new Map(),
}

export async function loadStations(): Promise<void> {
  const favs = await getFavorites()
  const pages: Page[] = []
  for (const fav of favs) {
    const station = stationById.get(fav.stationId)
    if (station && fav.platform < station.platformLabels.length) {
      pages.push({ station, platform: fav.platform })
    }
  }
  state.pages = pages
  if (state.currentIndex >= state.pages.length) {
    state.currentIndex = Math.max(0, state.pages.length - 1)
  }
}

export function currentPage(): Page | null {
  return state.pages[state.currentIndex] ?? null
}

export function nextPage(): void {
  if (state.pages.length === 0) return
  state.currentIndex = (state.currentIndex + 1) % state.pages.length
}

export function prevPage(): void {
  if (state.pages.length === 0) return
  state.currentIndex =
    (state.currentIndex - 1 + state.pages.length) % state.pages.length
}

export function getState() {
  return { pages: state.pages, currentIndex: state.currentIndex }
}

/**
 * Fetch arrivals for a BART station.
 * Tries legacy API first, falls back to GTFS-RT if proxy is configured.
 */
async function fetchBartStation(
  station: Station,
  settings: Settings
): Promise<StationArrivals> {
  // Try BART legacy API first
  const bartResult = await fetchBartArrivals(station, settings)
  if (bartResult && bartResult.platforms.some((p) => p.length > 0)) {
    return bartResult
  }

  // Fall back to GTFS-RT if proxy is configured
  if (settings.proxyBaseUrl) {
    return fetchViaGtfsRt(station, settings)
  }

  // No data available
  return {
    stationId: station.id,
    platforms: station.platformLabels.map(() => []),
    fetchedAt: Math.floor(Date.now() / 1000),
    source: 'bart-api',
  }
}

/**
 * Fetch arrivals via GTFS-RT (for Muni, or BART fallback).
 */
async function fetchViaGtfsRt(
  station: Station,
  settings: Settings
): Promise<StationArrivals> {
  const maxAgeMs = settings.gtfsRefreshSec * 1000

  const cached = getCached(station.agency, maxAgeMs)
  if (cached) {
    state.feedMap.set(station.agency, cached)
    return getStationArrivals(station, state.feedMap)
  }

  if (!canFetch()) {
    const stale = getCached(station.agency, Infinity)
    if (stale) {
      state.feedMap.set(station.agency, stale)
      return getStationArrivals(station, state.feedMap)
    }
    return {
      stationId: station.id,
      platforms: station.platformLabels.map(() => []),
      fetchedAt: Math.floor(Date.now() / 1000),
      source: 'gtfs-rt',
    }
  }

  // Only fetch GTFS-RT for stations that need it
  // (exclude BART stations when BART API key is configured)
  const gtfsStations = [
    ...new Map(
      state.pages
        .filter((p) => !(p.station.agency === 'BA' && settings.bartApiKey))
        .map((p) => [p.station.id, p.station])
    ).values(),
  ]
  const agencies = agenciesForStations(gtfsStations)
  const staleAgencies = agencies.filter((a) => !getCached(a, maxAgeMs))
  for (const _ of staleAgencies) recordRequest()

  try {
    const freshFeeds = await fetchAllFeeds(
      settings,
      gtfsStations.filter((s) => staleAgencies.includes(s.agency))
    )
    for (const [agency, entities] of freshFeeds) {
      setCached(agency, entities)
      state.feedMap.set(agency, entities)
    }
  } catch (err) {
    console.error('GTFS-RT fetch failed:', err)
  }

  return getStationArrivals(station, state.feedMap)
}

/**
 * Refresh arrivals for the current page.
 */
export async function refreshCurrentArrivals(
  settings: Settings
): Promise<StationArrivals | null> {
  const page = currentPage()
  if (!page) return null

  if (page.station.agency === 'BA') {
    return fetchBartStation(page.station, settings)
  } else {
    if (!settings.proxyBaseUrl && !settings.gtfsApiKey) {
      return {
        stationId: page.station.id,
        platforms: page.station.platformLabels.map(() => []),
        fetchedAt: Math.floor(Date.now() / 1000),
        source: 'gtfs-rt',
      }
    }
    return fetchViaGtfsRt(page.station, settings)
  }
}
