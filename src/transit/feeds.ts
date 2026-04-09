/**
 * GTFS-RT feed fetcher and protobuf decoder.
 *
 * Used for Muni stations and as BART fallback when the legacy API is unavailable.
 * Groups arrivals by platform stop_id (not direction_id).
 * Terminal names come from GTFS static route_long_name.
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { buildFetchOptions, agenciesForStations } from '../data/feed-urls'
import routeTerminals from '../data/route-terminals.json'
import stationsData from '../data/stations.json'
import type { Station, TrainArrival, StationArrivals, Settings } from '../types'
import { minutesUntil } from '../lib/time'

const terminals = routeTerminals as Record<string, string>
const allStations = stationsData as unknown as Station[]

// Build stop_id → station name lookup for resolving trip terminals
const stopIdToName = new Map<string, string>()
for (const s of allStations) {
  for (const sid of s.stops) {
    stopIdToName.set(sid, s.name)
  }
}

/** Resolve a stop_id to a human-readable station name, or null if unknown. */
function resolveStopName(stopId: string): string | null {
  return stopIdToName.get(stopId) || null
}

function displayRoute(routeId: string): string {
  return routeId.replace(/-[NS]$/, '')
}

function getTerminal(routeId: string, directionId: number): string {
  return (
    terminals[`${routeId}:${directionId}`] ||
    terminals[routeId] ||
    displayRoute(routeId)
  )
}

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity

async function fetchFeed(
  settings: Settings,
  agency: string
): Promise<FeedEntity[]> {
  const { url, init } = buildFetchOptions(settings, agency)
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`Feed ${response.status}: ${agency}`)
  const buffer = await response.arrayBuffer()

  let bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.slice(3)
  }

  const feed =
    GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes)
  return feed.entity || []
}

/**
 * Extract arrivals for a station, grouped by platform.
 */
export function extractArrivals(
  station: Station,
  entities: FeedEntity[]
): StationArrivals {
  const stationStopIds = new Set(station.stops)
  const now = Math.floor(Date.now() / 1000)
  const numPlatforms = station.platformLabels.length
  const platforms: TrainArrival[][] = Array.from({ length: numPlatforms }, () => [])

  for (const entity of entities) {
    const tu = entity.tripUpdate
    if (!tu?.trip || !tu.stopTimeUpdate) continue

    const routeId = (tu.trip.routeId as string) || ''
    const directionId = tu.trip.directionId ?? 0

    // Identify the last stop in this trip
    const updates = tu.stopTimeUpdate
    const lastStopId = updates.length > 0
      ? (updates[updates.length - 1].stopId as string)
      : ''

    // Use actual trip terminal if it differs from the route's typical terminal
    // (some trips turn around early, e.g. K ending at Montgomery instead of Balboa Park)
    const actualTerminal = lastStopId ? resolveStopName(lastStopId) : null
    const routeTerminal = getTerminal(routeId, directionId as number)
    const terminal = actualTerminal || routeTerminal

    for (const stu of updates) {
      const fullStopId = stu.stopId as string
      if (!fullStopId || !stationStopIds.has(fullStopId)) continue

      // Skip trains that terminate at this station (last stop is any of this station's stops)
      if (stationStopIds.has(lastStopId)) continue

      const arrTime = Number(
        stu.arrival?.time || stu.departure?.time || 0
      )
      if (arrTime === 0 || arrTime < now - 30) continue

      const platformIndex = station.platformMap[fullStopId] ?? 0
      if (platformIndex < numPlatforms) {
        platforms[platformIndex].push({
          route: displayRoute(routeId),
          stopId: fullStopId,
          arrivalTime: arrTime,
          minutesAway: minutesUntil(arrTime, now),
          terminal,
        })
      }
    }
  }

  for (const p of platforms) {
    p.sort((a, b) => a.arrivalTime - b.arrivalTime)
  }

  return { stationId: station.id, platforms, fetchedAt: now, source: 'gtfs-rt' }
}

export async function fetchAllFeeds(
  settings: Settings,
  savedStations: Station[]
): Promise<Map<string, FeedEntity[]>> {
  const agencies = agenciesForStations(savedStations)
  const feedMap = new Map<string, FeedEntity[]>()

  const results = await Promise.all(
    agencies.map(async (agency) => {
      try {
        const entities = await fetchFeed(settings, agency)
        return { agency, entities }
      } catch (err) {
        console.warn(`Feed failed for ${agency}:`, err)
        return { agency, entities: [] as FeedEntity[] }
      }
    })
  )

  for (const { agency, entities } of results) {
    feedMap.set(agency, entities)
  }

  return feedMap
}

export function getStationArrivals(
  station: Station,
  feedMap: Map<string, FeedEntity[]>
): StationArrivals {
  const entities = feedMap.get(station.agency) || []
  return extractArrivals(station, entities)
}
