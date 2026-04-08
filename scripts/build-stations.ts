/**
 * Build stations.json and route-terminals.json from 511.org GTFS static data.
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
  platformLabels: string[]
  platformMap: Record<string, number>
  bartAbbr?: string
}

// ── CSV parser (minimal, no dependency) ──

function parseCsv(text: string): Record<string, string>[] {
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

async function downloadGtfs(agencyId: string): Promise<Map<string, string>> {
  const url = `http://api.511.org/transit/datafeeds?api_key=${API_KEY}&operator_id=${agencyId}`
  console.log(`Downloading GTFS for ${agencyId}...`)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${agencyId}`)
  const buffer = await resp.arrayBuffer()
  const { execSync } = await import('child_process')
  const { tmpdir } = await import('os')
  const tmp = join(tmpdir(), `gtfs-${agencyId}`)
  const zipPath = `${tmp}.zip`
  writeFileSync(zipPath, Buffer.from(buffer))
  execSync(`rm -rf ${tmp} && mkdir -p ${tmp} && unzip -o -q ${zipPath} -d ${tmp}`)
  const { readFileSync } = await import('fs')
  const files = new Map<string, string>()
  for (const name of ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt']) {
    try { files.set(name, readFileSync(join(tmp, name), 'utf-8')) } catch {}
  }
  return files
}

// ── Build stop → routes mapping ──

function buildStopRoutes(tripsText: string, stopTimesText: string): Map<string, Set<string>> {
  const trips = parseCsv(tripsText)
  const tripToRoute = new Map<string, string>()
  for (const t of trips) tripToRoute.set(t.trip_id, t.route_id)

  const stopRoutes = new Map<string, Set<string>>()
  for (const st of parseCsv(stopTimesText)) {
    const route = tripToRoute.get(st.trip_id)
    if (!route) continue
    const routes = stopRoutes.get(st.stop_id) || new Set()
    routes.add(route)
    stopRoutes.set(st.stop_id, routes)
  }
  return stopRoutes
}

// ── Build route → terminal mapping ──

/**
 * Build route terminal mapping.
 * For BART: uses "X to Y" from route_long_name (keyed by route_id like "Red-N").
 * For Muni: derives terminal from the most common last stop per route+direction
 * (keyed as "route_id:direction_id" like "N:0").
 */
function buildRouteTerminals(
  routesText: string,
  tripsText: string,
  stopTimesText: string,
  stopsText: string
): Record<string, string> {
  const terminals: Record<string, string> = {}

  // 1. Try "X to Y" from route_long_name (works for BART)
  for (const r of parseCsv(routesText)) {
    const name = r.route_long_name || ''
    const parts = name.split(/\s+to\s+/i)
    if (parts.length === 2) {
      terminals[r.route_id] = parts[1].trim()
    }
  }

  // 2. For routes without "X to Y", derive from trip stop sequences
  const stopNames = new Map<string, string>()
  for (const s of parseCsv(stopsText)) {
    stopNames.set(s.stop_id, s.stop_name)
  }

  const trips = parseCsv(tripsText)
  const tripInfo = new Map<string, { routeId: string; directionId: string }>()
  for (const t of trips) {
    tripInfo.set(t.trip_id, { routeId: t.route_id, directionId: t.direction_id })
  }

  // Build trip → last stop
  const tripStops = new Map<string, Array<[number, string]>>()
  for (const st of parseCsv(stopTimesText)) {
    const arr = tripStops.get(st.trip_id) || []
    arr.push([parseInt(st.stop_sequence), st.stop_id])
    tripStops.set(st.trip_id, arr)
  }

  // Count terminal frequency per route:direction
  const terminalCounts = new Map<string, Map<string, number>>()
  for (const [tripId, seqs] of tripStops) {
    const info = tripInfo.get(tripId)
    if (!info) continue
    seqs.sort((a, b) => a[0] - b[0])
    const lastStopId = seqs[seqs.length - 1][1]
    const lastStopName = stopNames.get(lastStopId) || lastStopId
    // Clean up Muni stop names
    const cleanName = lastStopName
      .replace(/\s*BART\/.*$/, '')
      .replace(/^Metro\s+/, '')
      .replace(/\s+Station.*$/, '')
      .trim()

    const key = `${info.routeId}:${info.directionId}`
    if (terminals[info.routeId]) continue // already have from route_long_name

    const counts = terminalCounts.get(key) || new Map()
    counts.set(cleanName, (counts.get(cleanName) || 0) + 1)
    terminalCounts.set(key, counts)
  }

  // Pick most common terminal for each route:direction
  for (const [key, counts] of terminalCounts) {
    if (terminals[key]) continue
    let best = ''
    let bestCount = 0
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name
        bestCount = count
      }
    }
    if (best) terminals[key] = best
  }

  return terminals
}

// ── BART station builder ──

function buildBartStations(files: Map<string, string>): {
  stations: Station[]
  routeTerminals: Record<string, string>
} {
  const stops = parseCsv(files.get('stops.txt')!)
  const stopRoutes = buildStopRoutes(files.get('trips.txt')!, files.get('stop_times.txt')!)
  const routeTerminals = buildRouteTerminals(
    files.get('routes.txt')!,
    files.get('trips.txt')!,
    files.get('stop_times.txt')!,
    files.get('stops.txt')!
  )

  const parents = stops.filter((s) => s.location_type === '1')
  const childByParent = new Map<string, string[]>()
  for (const s of stops) {
    if (s.location_type === '0' && s.parent_station) {
      const kids = childByParent.get(s.parent_station) || []
      kids.push(s.stop_id)
      childByParent.set(s.parent_station, kids)
    }
  }

  // Determine platform grouping from trip data:
  // Two stops are on the same platform group if they serve overlapping route sets.
  // At BART, platform 01 and 02 serve different directions.
  const tripToStops = new Map<string, string[]>()
  for (const st of parseCsv(files.get('stop_times.txt')!)) {
    const stops = tripToStops.get(st.trip_id) || []
    stops.push(st.stop_id)
    tripToStops.set(st.trip_id, stops)
  }

  // For each station, group child stops by which routes they share
  const stations: Station[] = []
  for (const p of parents) {
    const children = (childByParent.get(p.stop_id) || []).sort()
    if (children.length === 0) continue

    // Collect routes from all child platforms
    const allRoutes = new Set<string>()
    for (const kid of children) {
      const rs = stopRoutes.get(kid)
      if (rs) for (const r of rs) allRoutes.add(r.replace(/-[NS]$/, ''))
    }

    // Group platforms: stops that share routes go in the same group
    // Simple heuristic for BART: odd-suffix stops (01) = group 0, even-suffix (02) = group 1
    // This works because BART consistently uses 01 for one direction and 02 for the other
    const platformMap: Record<string, number> = {}
    const groups: string[][] = [[], []]
    for (const kid of children) {
      const lastDigit = parseInt(kid.slice(-1))
      const group = lastDigit % 2 === 1 ? 0 : 1
      platformMap[kid] = group
      groups[group].push(kid)
    }

    // Label platforms as "Platform 1" and "Platform 2"
    const platformLabels = ['Platform 1', 'Platform 2']

    // Extract BART abbreviation from stop_url (e.g. "https://www.bart.gov/stations/mont" → "MONT")
    const urlMatch = (p.stop_url || '').match(/\/stations\/(\w+)/)
    const bartAbbr = urlMatch ? urlMatch[1].toUpperCase() : undefined

    stations.push({
      id: `bart-${p.stop_id}`,
      name: p.stop_name,
      stops: children,
      agency: 'BA',
      routes: [...allRoutes].sort(),
      lat: parseFloat(p.stop_lat),
      lng: parseFloat(p.stop_lon),
      platformLabels,
      platformMap,
      ...(bartAbbr ? { bartAbbr } : {}),
    })
  }

  return {
    stations: stations.sort((a, b) => a.name.localeCompare(b.name)),
    routeTerminals,
  }
}

// ── Muni station builder ──

function buildMuniStations(files: Map<string, string>): {
  stations: Station[]
  routeTerminals: Record<string, string>
} {
  const stops = parseCsv(files.get('stops.txt')!)
  const stopRoutes = buildStopRoutes(files.get('trips.txt')!, files.get('stop_times.txt')!)
  const routeTerminals = buildRouteTerminals(
    files.get('routes.txt')!,
    files.get('trips.txt')!,
    files.get('stop_times.txt')!,
    files.get('stops.txt')!
  )

  const RAIL_ROUTES = new Set(['N', 'J', 'K', 'L', 'M', 'T', 'F', 'CA', 'PH', 'PM'])

  const railStops = stops.filter((s) => {
    const routes = stopRoutes.get(s.stop_id)
    if (!routes) return false
    return [...routes].some((r) => RAIL_ROUTES.has(r))
  })

  // Build stop → dominant direction_id from trip data
  // Used to assign platforms when stop names don't indicate direction
  const tripDir = new Map<string, string>()
  for (const t of parseCsv(files.get('trips.txt')!)) {
    tripDir.set(t.trip_id, t.direction_id)
  }
  const stopDirCounts = new Map<string, { d0: number; d1: number }>()
  for (const st of parseCsv(files.get('stop_times.txt')!)) {
    const dir = tripDir.get(st.trip_id)
    if (dir === undefined) continue
    const counts = stopDirCounts.get(st.stop_id) || { d0: 0, d1: 0 }
    if (dir === '0') counts.d0++
    else counts.d1++
    stopDirCounts.set(st.stop_id, counts)
  }
  /** Returns 0 for outbound (dir=0), 1 for inbound (dir=1), based on majority usage */
  function dominantDirection(stopId: string): number {
    const counts = stopDirCounts.get(stopId)
    if (!counts) return 0
    return counts.d0 >= counts.d1 ? 0 : 1
  }

  const metroStops = railStops.filter((s) => s.stop_name.startsWith('Metro '))
  const surfaceStops = railStops.filter((s) => !s.stop_name.startsWith('Metro '))

  function metroBaseName(name: string): string {
    return name
      .replace(/^Metro\s+/, '')
      .replace(/\/(Downtown|Outbound|Downtn|Outbd)$/i, '')
      .replace(/\s+Station$/, '')
      .trim()
  }

  const metroGroups = new Map<string, typeof metroStops>()
  for (const s of metroStops) {
    const base = metroBaseName(s.stop_name)
    const group = metroGroups.get(base) || []
    group.push(s)
    metroGroups.set(base, group)
  }

  const stations: Station[] = []

  for (const [baseName, group] of metroGroups) {
    const allRoutes = new Set<string>()
    const stopIds: string[] = []
    let lat = 0, lng = 0
    for (const s of group) {
      stopIds.push(s.stop_id)
      const routes = stopRoutes.get(s.stop_id)
      if (routes) routes.forEach((r) => allRoutes.add(r))
      lat += parseFloat(s.stop_lat)
      lng += parseFloat(s.stop_lon)
    }
    lat /= group.length
    lng /= group.length

    // Assign platforms: use name suffix if available, otherwise direction_id from trip data
    // Platform 0 = Outbound, Platform 1 = Inbound
    const platformMap: Record<string, number> = {}
    for (const s of group) {
      if (/outbound|outbd/i.test(s.stop_name)) {
        platformMap[s.stop_id] = 0 // Outbound
      } else if (/downtown|downtn|inbound/i.test(s.stop_name)) {
        platformMap[s.stop_id] = 1 // Inbound / Downtown
      } else {
        // No direction in name — use dominant direction_id from trip data
        // Muni: direction_id=0 is outbound, direction_id=1 is inbound
        const dir = dominantDirection(s.stop_id)
        platformMap[s.stop_id] = dir === 0 ? 0 : 1
      }
    }

    stations.push({
      id: `muni-metro-${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: baseName,
      stops: stopIds.sort(),
      agency: 'SF',
      routes: [...allRoutes].filter((r) => RAIL_ROUTES.has(r)).sort(),
      lat, lng,
      platformLabels: ['Outbound', 'Inbound'],
      platformMap,
    })
  }

  // Surface stops — group by name
  function normalizeStopName(name: string): string {
    return name.replace(/\s+/g, ' ').trim().toLowerCase()
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
    let lat = 0, lng = 0
    for (const s of group) {
      stopIds.push(s.stop_id)
      const routes = stopRoutes.get(s.stop_id)
      if (routes) routes.forEach((r) => allRoutes.add(r))
      lat += parseFloat(s.stop_lat)
      lng += parseFloat(s.stop_lon)
    }
    lat /= group.length
    lng /= group.length

    // For surface stops, assign platforms by index (0, 1, ...)
    const platformMap: Record<string, number> = {}
    const sorted = [...stopIds].sort()
    sorted.forEach((sid, i) => { platformMap[sid] = Math.min(i, 1) })

    stations.push({
      id: `muni-${sorted.join('-')}`,
      name: group[0].stop_name,
      stops: sorted,
      agency: 'SF',
      routes: [...allRoutes].filter((r) => RAIL_ROUTES.has(r)).sort(),
      lat, lng,
      platformLabels: ['Outbound', 'Inbound'],
      platformMap,
    })
  }

  return {
    stations: stations.sort((a, b) => a.name.localeCompare(b.name)),
    routeTerminals,
  }
}

// ── Main ──

async function main() {
  const bartFiles = await downloadGtfs('BA')
  const muniFiles = await downloadGtfs('SF')

  const bart = buildBartStations(bartFiles)
  const muni = buildMuniStations(muniFiles)

  const allStations = [...bart.stations, ...muni.stations]
  const allTerminals = { ...bart.routeTerminals, ...muni.routeTerminals }

  console.log(`\nGenerated ${allStations.length} stations (${bart.stations.length} BART, ${muni.stations.length} Muni rail)`)
  console.log(`Route terminals: ${Object.keys(allTerminals).length}`)

  const outDir = join(import.meta.dirname, '..', 'src', 'data')
  mkdirSync(outDir, { recursive: true })

  writeFileSync(join(outDir, 'stations.json'), JSON.stringify(allStations, null, 2) + '\n')
  writeFileSync(join(outDir, 'route-terminals.json'), JSON.stringify(allTerminals, null, 2) + '\n')

  console.log(`Written to ${outDir}/stations.json and route-terminals.json`)
}

main().catch((err) => { console.error(err); process.exit(1) })
