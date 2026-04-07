/**
 * Glasses display renderer.
 *
 * Each page shows ONE platform for one station.
 * Format: "▶[Red] Richmond | 9    3m"
 *          marker route terminal cars  time (right-padded)
 */

import type { Station, TrainArrival } from '../types'
import { isArrivingSoon } from '../lib/time'

const MAX_TRAINS = 6
const CHARS_PER_LINE = 38

/**
 * Render the header: station name + agency + platform label.
 */
export function renderHeader(
  station: Station,
  platform: number
): string {
  const agency = station.agency === 'BA' ? 'BART' : 'Muni'
  const platLabel = station.platformLabels[platform] || `P${platform + 1}`
  const suffix = ` (${agency}) ${platLabel}`
  const maxNameLen = CHARS_PER_LINE - suffix.length
  const name =
    station.name.length > maxNameLen
      ? station.name.slice(0, maxNameLen - 2) + '..'
      : station.name
  return name + suffix
}

/**
 * Format a single train line.
 * With cars:    "▶[Red] Richmond | 9    3m"
 * Without cars: "▶[N] Ocean Beach        3m"
 */
function formatTrainLine(arrival: TrainArrival): string {
  const badge = `[${arrival.route}]`
  const time = arrival.minutesAway === 0 ? 'now' : `${arrival.minutesAway}m`
  // Pad time to 4 chars for alignment (e.g. " 3m", "now", "12m")
  const timePadded = time.padStart(4)

  const soon = isArrivingSoon(arrival.arrivalTime)
  const marker = soon ? '\u25B6' : ' '

  let middle: string
  if (arrival.cars) {
    // Truncate terminal shorter to make room for " | N"
    const maxTerm = CHARS_PER_LINE - marker.length - badge.length - 1 - 4 - timePadded.length - 1
    // " | N" = 4 chars
    const termLen = maxTerm - 4
    const terminal = arrival.terminal.length > termLen
      ? arrival.terminal.slice(0, termLen - 1) + '.'
      : arrival.terminal
    middle = `${terminal} | ${arrival.cars}`
  } else {
    const maxTerm = CHARS_PER_LINE - marker.length - badge.length - 1 - timePadded.length - 1
    const terminal = arrival.terminal.length > maxTerm
      ? arrival.terminal.slice(0, maxTerm - 1) + '.'
      : arrival.terminal
    middle = terminal
  }

  const left = `${marker}${badge} ${middle}`
  const gap = Math.max(1, CHARS_PER_LINE - left.length - timePadded.length)
  return left + ' '.repeat(gap) + timePadded
}

/**
 * Render the body for a single platform's trains.
 */
export function renderBody(
  station: Station,
  platform: number,
  trains: TrainArrival[],
  pageIndex: number,
  totalPages: number
): string {
  const lines: string[] = []

  const label = station.platformLabels[platform] || `Platform ${platform + 1}`
  lines.push(label)

  const display = trains.slice(0, MAX_TRAINS)
  if (display.length === 0) {
    lines.push('  No live data')
  } else {
    for (const t of display) {
      lines.push(formatTrainLine(t))
    }
  }

  if (totalPages > 1) {
    const pos = `${pageIndex + 1}/${totalPages}`
    const barLen = Math.min(20, CHARS_PER_LINE - pos.length - 1)
    const filled = Math.max(1, Math.round((barLen * (pageIndex + 1)) / totalPages))
    const empty = barLen - filled
    lines.push('\u2501'.repeat(filled) + '\u2500'.repeat(empty) + ' ' + pos)
  }

  return lines.join('\n')
}

export function renderLoading(): string {
  return '\n  Loading arrivals...\n'
}

export function renderNoStations(): string {
  return [
    '',
    '  No stations added.',
    '',
    '  Open settings on your',
    '  phone to add stations.',
  ].join('\n')
}
