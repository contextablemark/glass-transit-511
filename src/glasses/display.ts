/**
 * Glasses display renderer.
 *
 * Each page shows ONE platform for one station.
 * Platforms are labeled "Platform 1"/"Platform 2" (BART)
 * or "Outbound"/"Inbound" (Muni).
 */

import type { Station, TrainArrival } from '../types'
import { formatArrival, isArrivingSoon } from '../lib/time'

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

function formatTrainLine(arrival: TrainArrival, now: number): string {
  const badge = `[${arrival.route}]`
  const time = formatArrival(arrival.arrivalTime, now)
  const terminal =
    arrival.terminal.length > 19
      ? arrival.terminal.slice(0, 18) + '.'
      : arrival.terminal

  const soon = isArrivingSoon(arrival.arrivalTime, now)
  const marker = soon ? '\u25B6' : ' '

  const left = `${marker}${badge} ${terminal}`
  const gap = Math.max(1, CHARS_PER_LINE - left.length - time.length)
  return left + ' '.repeat(gap) + time
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
  const now = Math.floor(Date.now() / 1000)
  const lines: string[] = []

  const label = station.platformLabels[platform] || `Platform ${platform + 1}`
  lines.push(label)

  const display = trains.slice(0, MAX_TRAINS)
  if (display.length === 0) {
    lines.push('  No live data')
  } else {
    for (const t of display) {
      lines.push(formatTrainLine(t, now))
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
