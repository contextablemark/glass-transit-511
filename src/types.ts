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
  platformLabels: string[]
  /**
   * Map each stop_id to a platform index (0, 1, ...).
   * Trains at the same platform go the same geographic direction.
   */
  platformMap: Record<string, number>
  /** BART station abbreviation for legacy API (e.g. "MONT"). Only for agency=BA. */
  bartAbbr?: string
}

/** A single upcoming train arrival */
export interface TrainArrival {
  route: string          // display route name (e.g. "N", "Red")
  stopId: string         // full stop_id from feed (or platform number for BART API)
  arrivalTime: number    // Unix timestamp (seconds) — 0 for "Leaving"
  minutesAway: number    // minutes until arrival (0 = now/leaving)
  terminal: string       // destination name
  cars?: number          // train car count (BART legacy API only)
  color?: string         // line color name (BART legacy API only)
}

/** Arrivals grouped by platform for a station */
export interface StationArrivals {
  stationId: string
  platforms: TrainArrival[][] // platforms[0] = trains at platform 0, etc.
  fetchedAt: number
  source: 'bart-api' | 'gtfs-rt'
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
  // BART legacy API (optional but recommended)
  bartApiKey: string         // default: demo key
  bartRefreshSec: number     // default: 30

  // GTFS-RT via proxy (optional — needed for Muni + BART fallback)
  proxyBaseUrl: string
  gtfsApiKey: string         // 511.org BYOK key (empty = community GET)
  gtfsRefreshSec: number     // default: 60
}

export const DEFAULT_SETTINGS: Settings = {
  bartApiKey: '',
  bartRefreshSec: 30,
  proxyBaseUrl: '',
  gtfsApiKey: '',
  gtfsRefreshSec: 60,
}
