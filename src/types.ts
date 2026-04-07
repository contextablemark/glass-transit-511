/** A station complex from bundled station data */
export interface Station {
  id: string
  name: string
  stops: string[]       // GTFS stop_id values for all platforms at this station
  agency: 'BA' | 'SF'   // BART or SFMTA
  routes: string[]       // display route names (e.g. ["N", "J"] or ["Red", "Blue"])
  lat: number
  lng: number
  /** Platform labels — index corresponds to platform group (0-based). */
  platformLabels: string[]  // e.g. ["Platform 1", "Platform 2"] or ["Outbound", "Inbound"]
  /**
   * Map each stop_id to a platform index (0, 1, ...).
   * Trains at the same platform go the same geographic direction.
   */
  platformMap: Record<string, number>
}

/** A single upcoming train arrival */
export interface TrainArrival {
  route: string          // display route name (e.g. "N", "Red")
  stopId: string         // full stop_id from feed
  arrivalTime: number    // Unix timestamp (seconds)
  terminal: string       // route terminal name (from GTFS static route_long_name)
}

/** Arrivals grouped by platform for a station */
export interface StationArrivals {
  stationId: string
  platforms: TrainArrival[][] // platforms[0] = trains at platform 0, etc.
  fetchedAt: number
}

/**
 * A favorited station platform — each becomes one page on glasses.
 * `platform` is the platform index (0, 1, ...).
 */
export interface FavoriteEntry {
  stationId: string
  platform: number
}

/** User settings */
export interface Settings {
  proxyBaseUrl: string   // transit proxy URL (empty = relative, for dev)
  apiKey: string         // optional BYOK key (empty = community GET mode)
  refreshInterval: number // seconds (30, 60, 120)
}

export const DEFAULT_SETTINGS: Settings = {
  proxyBaseUrl: '',
  apiKey: '',
  refreshInterval: 60,
}
