/**
 * 511.org GTFS-RT feed URL builder.
 *
 * 511.org has one TripUpdates feed per agency (simpler than MTA's 8 route groups).
 * Requests go through our transit proxy which injects the API key server-side.
 */

import type { Settings } from '../types'

/**
 * Get the effective proxy base URL.
 * In dev mode, use the local Vite proxy (empty string = relative URLs).
 * In prod, use whatever is in settings (defaults to community proxy).
 */
function effectiveBase(settings: Settings): string {
  if (import.meta.env.DEV) return ''
  return settings.proxyBaseUrl.replace(/\/+$/, '')
}

/**
 * Build the URL for a GTFS-RT TripUpdates feed.
 * In dev mode (proxyBaseUrl=''), this is relative to the Vite dev server.
 * In prod, this points to the Cloudflare Worker.
 */
export function tripUpdatesUrl(settings: Settings, agency: string): string {
  const base = settings.proxyBaseUrl.replace(/\/+$/, '')
  return `${base}/transit/tripupdates?agency=${encodeURIComponent(agency)}`
}

/**
 * Determine which agencies need to be fetched based on saved stations.
 */
export function agenciesForStations(
  stations: { agency: string }[]
): string[] {
  return [...new Set(stations.map((s) => s.agency))]
}

/**
 * Build fetch options for the proxy.
 * Community mode (no apiKey): GET request, CDN-cacheable.
 * BYOK mode (apiKey set): POST with key in body.
 */
export function buildFetchOptions(
  settings: Settings,
  agency: string
): { url: string; init: RequestInit } {
  const base = effectiveBase(settings)

  if (settings.gtfsApiKey) {
    // BYOK: POST with key in body
    return {
      url: `${base}/transit/tripupdates`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency, apiKey: settings.gtfsApiKey }),
      },
    }
  }

  // Community: GET, CDN-cacheable
  return {
    url: `${base}/transit/tripupdates?agency=${encodeURIComponent(agency)}`,
    init: { method: 'GET' },
  }
}
