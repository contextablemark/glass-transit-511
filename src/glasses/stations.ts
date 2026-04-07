/**
 * Station manager — manages per-platform favorite pages
 * and coordinates feed fetching + arrival extraction.
 */

import stationsData from '../data/stations.json'
import type { Station, StationArrivals, Settings, FavoriteEntry } from '../types'
import { getFavorites } from '../lib/storage'
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
  platform: number // index into station.platformLabels / arrivals.platforms
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

export async function refreshCurrentArrivals(
  settings: Settings
): Promise<StationArrivals | null> {
  const page = currentPage()
  if (!page) return null

  const maxAgeMs = settings.refreshInterval * 1000
  const cached = getCached(page.station.agency, maxAgeMs)
  if (cached) {
    state.feedMap.set(page.station.agency, cached)
    return getStationArrivals(page.station, state.feedMap)
  }

  if (!canFetch()) {
    const stale = getCached(page.station.agency, Infinity)
    if (stale) {
      state.feedMap.set(page.station.agency, stale)
      return getStationArrivals(page.station, state.feedMap)
    }
    return {
      stationId: page.station.id,
      platforms: page.station.platformLabels.map(() => []),
      fetchedAt: Math.floor(Date.now() / 1000),
    }
  }

  const uniqueStations = [
    ...new Map(state.pages.map((p) => [p.station.id, p.station])).values(),
  ]
  const agencies = agenciesForStations(uniqueStations)
  const staleAgencies = agencies.filter((a) => !getCached(a, maxAgeMs))
  for (const _ of staleAgencies) recordRequest()

  try {
    const freshFeeds = await fetchAllFeeds(
      settings,
      uniqueStations.filter((s) => staleAgencies.includes(s.agency))
    )
    for (const [agency, entities] of freshFeeds) {
      setCached(agency, entities)
      state.feedMap.set(agency, entities)
    }
  } catch (err) {
    console.error('Feed fetch failed:', err)
  }

  return getStationArrivals(page.station, state.feedMap)
}
