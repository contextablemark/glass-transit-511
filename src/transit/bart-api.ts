/**
 * BART Legacy API client.
 *
 * Fetches real-time departure estimates from api.bart.gov.
 * Richer than GTFS-RT: includes car count, platform, line color, destination names.
 * No CORS issues — api.bart.gov sends Access-Control-Allow-Origin: *.
 * No proxy needed.
 *
 * Endpoint: https://api.bart.gov/api/etd.aspx?cmd=etd&orig={abbr}&key={key}&json=y
 */

import type { Station, StationArrivals, TrainArrival, Settings } from '../types'
// No key baked in — user must provide their own via settings

interface BartEtdResponse {
  root: {
    station: Array<{
      name: string
      abbr: string
      etd: Array<{
        destination: string
        abbreviation: string
        estimate: Array<{
          minutes: string      // number or "Leaving"
          platform: string     // "1" or "2"
          direction: string    // "North" or "South"
          length: string       // car count
          color: string        // "YELLOW", "RED", etc.
          hexcolor: string
          delay: string
          cancelflag: string
        }>
      }>
    }>
  }
}

/**
 * Fetch real-time departures from the BART legacy API.
 * Returns null if the station has no bartAbbr or the fetch fails.
 */
export async function fetchBartArrivals(
  station: Station,
  settings: Settings
): Promise<StationArrivals | null> {
  if (station.agency !== 'BA' || !station.bartAbbr) return null

  const key = settings.bartApiKey
  if (!key) return null
  const url = `https://api.bart.gov/api/etd.aspx?cmd=etd&orig=${station.bartAbbr}&key=${key}&json=y`

  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const data: BartEtdResponse = await resp.json()

    const stationData = data.root?.station?.[0]
    if (!stationData?.etd) return null

    const now = Math.floor(Date.now() / 1000)
    const numPlatforms = station.platformLabels.length
    const platforms: TrainArrival[][] = Array.from({ length: numPlatforms }, () => [])

    for (const etd of stationData.etd) {
      for (const est of etd.estimate) {
        if (est.cancelflag === '1') continue

        const mins = est.minutes === 'Leaving' ? 0 : parseInt(est.minutes) || 0
        const platformNum = parseInt(est.platform) || 1
        const platformIndex = platformNum - 1 // API uses 1-based, we use 0-based

        // Capitalize color for display: "YELLOW" → "Yellow"
        const colorDisplay = est.color
          ? est.color.charAt(0) + est.color.slice(1).toLowerCase()
          : ''

        const arrival: TrainArrival = {
          route: colorDisplay,
          stopId: `platform-${est.platform}`,
          arrivalTime: now + mins * 60,
          minutesAway: mins,
          terminal: etd.destination,
          cars: parseInt(est.length) || undefined,
          color: colorDisplay,
        }

        if (platformIndex >= 0 && platformIndex < numPlatforms) {
          platforms[platformIndex].push(arrival)
        }
      }
    }

    // Sort each platform by minutes away
    for (const p of platforms) {
      p.sort((a, b) => a.minutesAway - b.minutesAway)
    }

    return {
      stationId: station.id,
      platforms,
      fetchedAt: now,
      source: 'bart-api',
    }
  } catch (err) {
    console.warn('[bart-api] fetch failed:', err)
    return null
  }
}
