/**
 * Glasses display renderer.
 *
 * Formats station arrival data into text for G2 text containers.
 * Adapted from SubwayLens display.ts for BART/Muni.
 *
 * Unicode chars confirmed in G2 firmware font:
 *   ━ (U+2501) heavy horizontal    ─ (U+2500) light horizontal
 *   ▲ (U+25B2) up triangle         ▼ (U+25BC) down triangle
 *   ★ (U+2605) filled star         ▶ (U+25B6) right triangle
 */

import type { Station, StationArrivals, TrainArrival } from '../types'
import { formatArrival, isArrivingSoon } from '../lib/time'

/** Max trains per direction to show */
const MAX_TRAINS = 3

/** Approximate chars per line on G2 display */
const CHARS_PER_LINE = 38

/**
 * Render the header text container content.
 * Shows: station name + agency + favorite star.
 */
export function renderHeader(
  station: Station,
  isFavorite: boolean
): string {
  const star = isFavorite ? ' \u2605' : '' // ★
  const agency = station.agency === 'BA' ? 'BART' : 'Muni'
  const suffix = ` (${agency})${star}`
  const maxNameLen = CHARS_PER_LINE - suffix.length
  const name =
    station.name.length > maxNameLen
      ? station.name.slice(0, maxNameLen - 2) + '..'
      : station.name
  return name + suffix
}

/**
 * Format a single train line: "▶[R] Terminal    N min - H:MM"
 */
function formatTrainLine(arrival: TrainArrival, now: number): string {
  const badge = `[${arrival.route}]`
  const time = formatArrival(arrival.arrivalTime, now)
  const terminal =
    arrival.terminal.length > 19
      ? arrival.terminal.slice(0, 18) + '.'
      : arrival.terminal

  const soon = isArrivingSoon(arrival.arrivalTime, now)
  const marker = soon ? '\u25B6' : ' ' // ▶

  const left = `${marker}${badge} ${terminal}`
  const gap = Math.max(1, CHARS_PER_LINE - left.length - time.length)
  return left + ' '.repeat(gap) + time
}

/**
 * Build a direction label from train terminals.
 * Uses the most common terminal among the trains.
 * Falls back to station's static label.
 */
function directionLabel(
  trains: TrainArrival[],
  fallback: string
): string {
  if (trains.length === 0) return fallback
  const termToRoutes = new Map<string, string[]>()
  for (const t of trains) {
    const routes = termToRoutes.get(t.terminal) || []
    if (!routes.includes(t.route)) routes.push(t.route)
    termToRoutes.set(t.terminal, routes)
  }
  let best = ''
  let bestCount = 0
  for (const [term, routes] of termToRoutes) {
    if (routes.length > bestCount) {
      best = term
      bestCount = routes.length
    }
  }
  return best
}

/**
 * Render the body text container content.
 * Shows both directions with arrivals and progress bar.
 */
export function renderBody(
  station: Station,
  arrivals: StationArrivals,
  stationIndex: number,
  totalStations: number
): string {
  const now = Math.floor(Date.now() / 1000)
  const lines: string[] = []

  // ── North / Outbound direction ──
  const northTrains = arrivals.north.slice(0, MAX_TRAINS)
  const northLabel = directionLabel(northTrains, station.north)
  lines.push(`\u25B2 ${northLabel}`) // ▲

  if (northTrains.length === 0) {
    lines.push('  No live data')
  } else {
    for (const t of northTrains) {
      lines.push(formatTrainLine(t, now))
    }
  }

  // Dashed divider
  lines.push('\u2500 '.repeat(Math.floor(CHARS_PER_LINE / 2)))

  // ── South / Inbound direction ──
  const southTrains = arrivals.south.slice(0, MAX_TRAINS)
  const southLabel = directionLabel(southTrains, station.south)
  lines.push(`\u25BC ${southLabel}`) // ▼

  if (southTrains.length === 0) {
    lines.push('  No live data')
  } else {
    for (const t of southTrains) {
      lines.push(formatTrainLine(t, now))
    }
  }

  // Progress bar
  if (totalStations > 1) {
    const pos = `${stationIndex + 1}/${totalStations}`
    const barTotal = CHARS_PER_LINE - pos.length - 1
    const filled = Math.max(
      1,
      Math.round((barTotal * (stationIndex + 1)) / totalStations)
    )
    const empty = barTotal - filled
    const bar = '\u2501'.repeat(filled) + '\u2500'.repeat(empty)
    lines.push(bar + ' ' + pos)
  }

  return lines.join('\n')
}

/** Loading screen for body container. */
export function renderLoading(): string {
  return '\n  Loading arrivals...\n'
}

/** Empty state when no stations are configured. */
export function renderNoStations(): string {
  return [
    '',
    '  No stations added.',
    '',
    '  Open settings on your',
    '  phone to add stations.',
  ].join('\n')
}
