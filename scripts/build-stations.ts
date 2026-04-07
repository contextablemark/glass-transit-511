/**
 * Build stations.json from 511.org GTFS static data.
 *
 * Downloads BART and Muni GTFS feeds, parses stops/routes/stop_times,
 * and generates a bundled station database for the app.
 *
 * Usage:
 *   API_511_KEY=your-key npx tsx scripts/build-stations.ts
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const API_KEY = process.env.API_511_KEY
if (!API_KEY) {
  console.error('Set API_511_KEY environment variable')
  process.exit(1)
}

interface Station {
  id: string
  name: string
  stops: string[]
  agency: 'BA' | 'SF'
  routes: string[]
  lat: number
  lng: number
  north: string
  south: string
}

// ── CSV parser (minimal, no dependency) ──

function parseCsv(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const lines = text.split('\n').filter((l) => l.trim())
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => (row[h] = values[i] || ''))
    return row
  })
}

// ── Download + unzip GTFS ──

async function downloadGtfs(
  agencyId: string
): Promise<Map<string, string>> {
  const url = `http://api.511.org/transit/datafeeds?api_key=${API_KEY}&operator_id=${agencyId}`
  console.log(`Downloading GTFS for ${agencyId}...`)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${agencyId}`)
  const buffer = await resp.arrayBuffer()

  // Use Node's built-in zlib + manual zip parsing isn't worth it — use unzipper approach
  // Write to temp, shell out to unzip
  const { execSync } = await import('child_process')
  const { tmpdir } = await import('os')
  const tmp = join(tmpdir(), `gtfs-${agencyId}`)
  const zipPath = `${tmp}.zip`

  writeFileSync(zipPath, Buffer.from(buffer))
  execSync(`rm -rf ${tmp} && mkdir -p ${tmp} && unzip -o -q ${zipPath} -d ${tmp}`)

  // Read relevant files
  const { readFileSync } = await import('fs')
  const files = new Map<string, string>()
  for (const name of [
    'stops.txt',
    'routes.txt',
    'trips.txt',
    'stop_times.txt',
  ]) {
    try {
      files.set(name, readFileSync(join(tmp, name), 'utf-8'))
    } catch {
      console.warn(`  Missing ${name} for ${agencyId}`)
    }
  }
  return files
}

// ── Build stop → routes mapping ──

function buildStopRoutes(
  tripsText: string,
  stopTimesText: string
): Map<string, Set<string>> {
  const trips = parseCsv(tripsText)
  const tripToRoute = new Map<string, string>()
  for (const t of trips) {
    tripToRoute.set(t.trip_id, t.route_id)
  }

  const stopRoutes = new Map<string, Set<string>>()
  const stopTimes = parseCsv(stopTimesText)
  for (const st of stopTimes) {
    const route = tripToRoute.get(st.trip_id)
    if (!route) continue
    const routes = stopRoutes.get(st.stop_id) || new Set()
    routes.add(route)
    stopRoutes.set(st.stop_id, routes)
  }
  return stopRoutes
}

// ── BART station builder ──

function buildBartStations(files: Map<string, string>): Station[] {
  const stops = parseCsv(files.get('stops.txt')!)
  const stopRoutes = buildStopRoutes(
    files.get('trips.txt')!,
    files.get('stop_times.txt')!
  )
  const routes = parseCsv(files.get('routes.txt')!)

  // Route direction labels from route_long_name
  // e.g. "Berryessa/North San Jose to Richmond" → northLabel="Richmond"
  const routeInfo = new Map<string, { color: string; longName: string }>()
  for (const r of routes) {
    routeInfo.set(r.route_id, {
      color: r.route_color || '',
      longName: r.route_long_name || '',
    })
  }

  // Group: parent stations (location_type=1) with child platforms (location_type=0)
  const parents = stops.filter((s) => s.location_type === '1')
  const childByParent = new Map<string, string[]>()
  for (const s of stops) {
    if (s.location_type === '0' && s.parent_station) {
      const kids = childByParent.get(s.parent_station) || []
      kids.push(s.stop_id)
      childByParent.set(s.parent_station, kids)
    }
  }

  const stations: Station[] = []
  for (const p of parents) {
    const children = childByParent.get(p.stop_id) || []
    if (children.length === 0) continue

    // Collect routes from all child platforms, strip direction suffix
    const allRoutes = new Set<string>()
    for (const kid of children) {
      const rs = stopRoutes.get(kid)
      if (rs) {
        for (const r of rs) {
          allRoutes.add(r.replace(/-[NS]$/, ''))
        }
      }
    }

    // Determine direction labels from route long names
    // Pattern: "X to Y" — for -N routes Y is the north terminal, for -S routes Y is south
    let northLabel = 'Northbound'
    let southLabel = 'Southbound'
    for (const r of routes) {
      if (!r.route_id.endsWith('-N')) continue
      const base = r.route_id.replace(/-N$/, '')
      if (!allRoutes.has(base)) continue
      const match = r.route_long_name?.match(/to\s+(.+)$/i)
      if (match) {
        northLabel = match[1].trim()
        break
      }
    }
    for (const r of routes) {
      if (!r.route_id.endsWith('-S')) continue
      const base = r.route_id.replace(/-S$/, '')
      if (!allRoutes.has(base)) continue
      const match = r.route_long_name?.match(/to\s+(.+)$/i)
      if (match) {
        southLabel = match[1].trim()
        break
      }
    }

    stations.push({
      id: `bart-${p.stop_id}`,
      name: p.stop_name,
      stops: children.sort(),
      agency: 'BA',
      routes: [...allRoutes].sort(),
      lat: parseFloat(p.stop_lat),
      lng: parseFloat(p.stop_lon),
      north: northLabel,
      south: southLabel,
    })
  }

  return stations.sort((a, b) => a.name.localeCompare(b.name))
}

// ── Muni station builder ──

function buildMuniStations(files: Map<string, string>): Station[] {
  const stops = parseCsv(files.get('stops.txt')!)
  const stopRoutes = buildStopRoutes(
    files.get('trips.txt')!,
    files.get('stop_times.txt')!
  )

  const RAIL_ROUTES = new Set(['N', 'J', 'K', 'L', 'M', 'T', 'F', 'CA', 'PH', 'PM'])

  // Muni has no parent station hierarchy. Group stops by proximity + name.
  // Strategy:
  //   1. Metro underground stations: group by base name (strip Downtown/Outbound/etc)
  //   2. Surface rail stops: group by name (opposite-direction pairs at same intersection)
  //   3. Only include stops served by rail routes (skip bus-only for v1)

  // Find stops served by at least one rail route
  const railStops = stops.filter((s) => {
    const routes = stopRoutes.get(s.stop_id)
    if (!routes) return false
    return [...routes].some((r) => RAIL_ROUTES.has(r))
  })

  // Group Metro stations by base name
  // "Metro Embarcadero Station" + "Metro Embarcadero Station" → one station
  // "Metro Church Station/Downtown" + "Metro Church Station/Outbound" → one station
  const metroStops = railStops.filter((s) =>
    s.stop_name.startsWith('Metro ')
  )
  const surfaceStops = railStops.filter(
    (s) => !s.stop_name.startsWith('Metro ')
  )

  // Normalize Metro name: strip "Metro " prefix and /Downtown, /Outbound, /Downtn, /Outbd suffixes
  function metroBaseName(name: string): string {
    return name
      .replace(/^Metro\s+/, '')
      .replace(/\/(Downtown|Outbound|Downtn|Outbd)$/i, '')
      .replace(/\s+Station$/, '')
      .trim()
  }

  // Group metro stops by base name
  const metroGroups = new Map<string, typeof metroStops>()
  for (const s of metroStops) {
    const base = metroBaseName(s.stop_name)
    const group = metroGroups.get(base) || []
    group.push(s)
    metroGroups.set(base, group)
  }

  const stations: Station[] = []

  // Build metro stations
  for (const [baseName, group] of metroGroups) {
    const allRoutes = new Set<string>()
    const stopIds: string[] = []
    let lat = 0
    let lng = 0
    for (const s of group) {
      stopIds.push(s.stop_id)
      const routes = stopRoutes.get(s.stop_id)
      if (routes) routes.forEach((r) => allRoutes.add(r))
      lat += parseFloat(s.stop_lat)
      lng += parseFloat(s.stop_lon)
    }
    lat /= group.length
    lng /= group.length

    stations.push({
      id: `muni-metro-${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: baseName,
      stops: stopIds.sort(),
      agency: 'SF',
      routes: [...allRoutes].filter((r) => RAIL_ROUTES.has(r)).sort(),
      lat,
      lng,
      north: 'Outbound',
      south: 'Inbound',
    })
  }

  // Group surface stops by normalized name (group nearby same-name stops)
  function normalizeStopName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  const surfaceGroups = new Map<string, typeof surfaceStops>()
  for (const s of surfaceStops) {
    const key = normalizeStopName(s.stop_name)
    const group = surfaceGroups.get(key) || []
    group.push(s)
    surfaceGroups.set(key, group)
  }

  for (const [, group] of surfaceGroups) {
    const allRoutes = new Set<string>()
    const stopIds: string[] = []
    let lat = 0
    let lng = 0
    for (const s of group) {
      stopIds.push(s.stop_id)
      const routes = stopRoutes.get(s.stop_id)
      if (routes) routes.forEach((r) => allRoutes.add(r))
      lat += parseFloat(s.stop_lat)
      lng += parseFloat(s.stop_lon)
    }
    lat /= group.length
    lng /= group.length

    // Use the original-case name from the first stop
    const displayName = group[0].stop_name

    stations.push({
      id: `muni-${stopIds.sort().join('-')}`,
      name: displayName,
      stops: stopIds,
      agency: 'SF',
      routes: [...allRoutes].filter((r) => RAIL_ROUTES.has(r)).sort(),
      lat,
      lng,
      north: 'Outbound',
      south: 'Inbound',
    })
  }

  return stations.sort((a, b) => a.name.localeCompare(b.name))
}

// ── Main ──

async function main() {
  const bartFiles = await downloadGtfs('BA')
  const muniFiles = await downloadGtfs('SF')

  const bartStations = buildBartStations(bartFiles)
  const muniStations = buildMuniStations(muniFiles)

  const all = [...bartStations, ...muniStations]

  console.log(
    `\nGenerated ${all.length} stations (${bartStations.length} BART, ${muniStations.length} Muni rail)`
  )

  const outDir = join(import.meta.dirname, '..', 'src', 'data')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'stations.json')
  writeFileSync(outPath, JSON.stringify(all, null, 2) + '\n')
  console.log(`Written to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
