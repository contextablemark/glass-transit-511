/**
 * Glasses display renderer.
 *
 * Each page shows ONE platform for one station.
 *
 * Format with cars:    "▶[Red] Richmond      3m | 9 car"
 * Format without cars: "▶[N] Ocean Beach          3m"
 *
 * Times are right-aligned. Car count appears after time with " | ".
 */

import type { Station, TrainArrival } from '../types'
import { isArrivingSoon } from '../lib/time'

const MAX_TRAINS = 6
const CHARS_PER_LINE = 38

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
 * Format a single train line with right-aligned time.
 *
 * Layout: "{marker}{badge} {terminal}{padding}{time}{ | N car}"
 *
 * The time + car suffix is a fixed-width block at the right edge.
 * Terminal is truncated to fill the remaining space.
 */
function formatTrainLine(arrival: TrainArrival): string {
  const soon = isArrivingSoon(arrival.arrivalTime)
  const marker = soon ? '\u25B6' : ' '
  const badge = `[${arrival.route}]`

  // Build right-side: time + optional car count
  const timeStr = arrival.minutesAway === 0 ? 'Now' : `${arrival.minutesAway}m`
  const carStr = arrival.cars != null ? ` | ${arrival.cars} car` : ''
  const rightSide = timeStr + carStr
  // Pad right side so time column aligns (pad timeStr to 4 chars before car suffix)
  const timePadded = arrival.minutesAway === 0 ? ' Now' : `${arrival.minutesAway}m`.padStart(4)
  const rightAligned = timePadded + carStr

  // Left side: marker + badge + space
  const leftPrefix = `${marker}${badge} `

  // Terminal gets whatever space remains
  const availForTerminal = CHARS_PER_LINE - leftPrefix.length - rightAligned.length - 1
  const terminal = arrival.terminal.length > availForTerminal
    ? arrival.terminal.slice(0, Math.max(1, availForTerminal - 1)) + '.'
    : arrival.terminal

  const left = leftPrefix + terminal
  const gap = Math.max(1, CHARS_PER_LINE - left.length - rightAligned.length)
  return left + ' '.repeat(gap) + rightAligned
}

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
