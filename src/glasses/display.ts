/**
 * Glasses display renderer.
 *
 * Each page shows ONE direction for a station (not both).
 * This gives more room for trains and eliminates the separator.
 *
 * Unicode chars confirmed in G2 firmware font:
 *   ━ (U+2501) heavy horizontal    ─ (U+2500) light horizontal
 *   ▲ (U+25B2) up triangle         ▼ (U+25BC) down triangle
 *   ★ (U+2605) filled star         ▶ (U+25B6) right triangle
 */

import type { Station, TrainArrival } from '../types'
import { formatArrival, isArrivingSoon } from '../lib/time'

/** Max trains to show per page (single direction) */
const MAX_TRAINS = 6

/** Approximate chars per line on G2 display */
const CHARS_PER_LINE = 38

/**
 * Render the header text container content.
 * Shows: station name + agency + direction arrow.
 */
export function renderHeader(
  station: Station,
  direction: 'N' | 'S'
): string {
  const agency = station.agency === 'BA' ? 'BART' : 'Muni'
  const arrow = direction === 'N' ? '\u25B2' : '\u25BC' // ▲ or ▼
  const suffix = ` (${agency}) ${arrow}`
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
 * Render the body text container content for a single direction.
 * Shows direction label, trains, and compact progress bar.
 */
export function renderBody(
  station: Station,
  direction: 'N' | 'S',
  trains: TrainArrival[],
  pageIndex: number,
  totalPages: number
): string {
  const now = Math.floor(Date.now() / 1000)
  const lines: string[] = []

  const fallback = direction === 'N' ? station.north : station.south
  const arrow = direction === 'N' ? '\u25B2' : '\u25BC'
  const label = directionLabel(trains, fallback)
  lines.push(`${arrow} ${label}`)

  const display = trains.slice(0, MAX_TRAINS)
  if (display.length === 0) {
    lines.push('  No live data')
  } else {
    for (const t of display) {
      lines.push(formatTrainLine(t, now))
    }
  }

  // Compact progress bar (only if multiple pages)
  if (totalPages > 1) {
    const pos = `${pageIndex + 1}/${totalPages}`
    // Keep bar short to fit on one line
    const barLen = Math.min(20, CHARS_PER_LINE - pos.length - 1)
    const filled = Math.max(1, Math.round((barLen * (pageIndex + 1)) / totalPages))
    const empty = barLen - filled
    lines.push('\u2501'.repeat(filled) + '\u2500'.repeat(empty) + ' ' + pos)
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
