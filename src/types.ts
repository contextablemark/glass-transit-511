/** A station complex from bundled station data */
export interface Station {
  id: string
  name: string
  stops: string[]       // GTFS stop_id values for all platforms at this station
  agency: 'BA' | 'SF'   // BART or SFMTA
  routes: string[]       // route_ids serving this station (e.g. ["N", "J"] or ["Red", "Blue"])
  lat: number
  lng: number
  north: string          // direction label (e.g. "Richmond" or "Outbound")
  south: string          // direction label (e.g. "Millbrae/SFO" or "Inbound")
}

/** A single upcoming train/bus arrival */
export interface TrainArrival {
  route: string          // display route name (e.g. "N", "Red") — stripped of direction suffix
  direction: 'N' | 'S'  // from direction_id: 0='N', 1='S'
  stopId: string         // full stop_id from feed
  arrivalTime: number    // Unix timestamp (seconds)
  terminal: string       // last stop name in trip
}

/** Arrivals grouped by direction for a station */
export interface StationArrivals {
  stationId: string
  north: TrainArrival[]  // sorted by arrivalTime
  south: TrainArrival[]
  fetchedAt: number      // Unix timestamp (seconds)
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
