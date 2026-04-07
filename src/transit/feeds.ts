/**
 * GTFS-RT feed fetcher and protobuf decoder.
 *
 * Adapted from SubwayLens mta-feeds.ts for 511.org.
 * Key differences:
 *   - 511.org has one feed per agency (not per route group)
 *   - Direction from direction_id (0/1), not stop_id suffix
 *   - Requests go through transit proxy (CORS + API key injection)
 *   - 511.org may prepend UTF-8 BOM to responses
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { buildFetchOptions, agenciesForStations } from '../data/feed-urls'
import stationsData from '../data/stations.json'
import type { Station, TrainArrival, StationArrivals, Settings } from '../types'

const stations = stationsData as Station[]

// stop_id → station name lookup
const stopIdToName = new Map<string, string>()
for (const s of stations) {
  for (const sid of s.stops) {
    stopIdToName.set(sid, s.name)
  }
}

/** Resolve a stop_id to a human-readable station name. */
function resolveStopName(stopId: string): string {
  return stopIdToName.get(stopId) || stopId
}

/**
 * Strip BART direction suffix from route_id for display.
 * "Red-N" → "Red", "Blue-S" → "Blue"
 * Muni route_ids don't have suffixes, so this is a no-op for them.
 */
function displayRoute(routeId: string): string {
  return routeId.replace(/-[NS]$/, '')
}

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity

/**
 * Fetch and decode a GTFS-RT feed from the transit proxy.
 */
async function fetchFeed(
  settings: Settings,
  agency: string
): Promise<FeedEntity[]> {
  const { url, init } = buildFetchOptions(settings, agency)
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`Feed ${response.status}: ${agency}`)
  const buffer = await response.arrayBuffer()

  // 511.org may prepend UTF-8 BOM — strip before protobuf decode
  let bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.slice(3)
  }

  const feed =
    GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes)
  return feed.entity || []
}

/**
 * Extract arrivals for a specific station from feed entities.
 */
export function extractArrivals(
  station: Station,
  entities: FeedEntity[]
): StationArrivals {
  const stationStopIds = new Set(station.stops)
  const now = Math.floor(Date.now() / 1000)
  const north: TrainArrival[] = []
  const south: TrainArrival[] = []

  for (const entity of entities) {
    const tu = entity.tripUpdate
    if (!tu?.trip || !tu.stopTimeUpdate) continue

    const routeId = (tu.trip.routeId as string) || ''
    const directionId = tu.trip.directionId ?? 0

    // Terminal = last stop in trip
    const updates = tu.stopTimeUpdate
    const lastStop = updates[updates.length - 1]
    const terminalName = lastStop?.stopId
      ? resolveStopName(lastStop.stopId as string)
      : displayRoute(routeId)

    for (const stu of updates) {
      const fullStopId = stu.stopId as string
      if (!fullStopId || !stationStopIds.has(fullStopId)) continue

      const arrTime = Number(
        stu.arrival?.time || stu.departure?.time || 0
      )
      if (arrTime === 0 || arrTime < now - 30) continue

      const arrival: TrainArrival = {
        route: displayRoute(routeId),
        direction: directionId === 0 ? 'N' : 'S',
        stopId: fullStopId,
        arrivalTime: arrTime,
        terminal: terminalName,
      }

      if (directionId === 0) {
        north.push(arrival)
      } else {
        south.push(arrival)
      }
    }
  }

  north.sort((a, b) => a.arrivalTime - b.arrivalTime)
  south.sort((a, b) => a.arrivalTime - b.arrivalTime)

  return { stationId: station.id, north, south, fetchedAt: now }
}

/**
 * Fetch all feeds needed for a set of stations, returning cached entities per agency.
 */
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

/**
 * Get arrivals for a station from cached feed entities.
 */
export function getStationArrivals(
  station: Station,
  feedMap: Map<string, FeedEntity[]>
): StationArrivals {
  const entities = feedMap.get(station.agency) || []
  return extractArrivals(station, entities)
}
