import { describe, it, expect } from 'vitest'
import {
  renderHeader,
  renderBody,
  renderLoading,
  renderNoStations,
} from '../display'
import type { Station, TrainArrival } from '../../types'

const bartStation: Station = {
  id: 'bart-901209',
  name: 'Montgomery Street',
  stops: ['901201', '901202'],
  agency: 'BA',
  routes: ['Blue', 'Green', 'Red', 'Yellow'],
  lat: 37.789,
  lng: -122.401,
  north: 'Richmond',
  south: 'Daly City',
}

const muniStation: Station = {
  id: 'muni-metro-embarcadero',
  name: 'Embarcadero',
  stops: ['16992', '17217'],
  agency: 'SF',
  routes: ['J', 'K', 'L', 'M', 'N'],
  lat: 37.793,
  lng: -122.396,
  north: 'Outbound',
  south: 'Inbound',
}

const now = 1700000000

describe('renderHeader', () => {
  it('shows BART station with agency and direction arrow', () => {
    const h = renderHeader(bartStation, 'N')
    expect(h).toContain('Montgomery Street')
    expect(h).toContain('(BART)')
    expect(h).toContain('\u25B2') // ▲
  })

  it('shows Muni station with south arrow', () => {
    const h = renderHeader(muniStation, 'S')
    expect(h).toContain('Embarcadero')
    expect(h).toContain('(Muni)')
    expect(h).toContain('\u25BC') // ▼
  })

  it('truncates long station names', () => {
    const longStation = { ...bartStation, name: 'A'.repeat(50) }
    const h = renderHeader(longStation, 'N')
    expect(h.length).toBeLessThanOrEqual(42)
    expect(h).toContain('..')
  })
})

describe('renderBody', () => {
  it('shows trains for a single direction', () => {
    const trains: TrainArrival[] = [
      { route: 'Red', direction: 'N', stopId: '901201', arrivalTime: now + 180, terminal: 'Richmond' },
      { route: 'Yellow', direction: 'N', stopId: '901201', arrivalTime: now + 600, terminal: 'Antioch' },
    ]

    const body = renderBody(bartStation, 'N', trains, 0, 3)
    expect(body).toContain('\u25B2') // ▲
    expect(body).toContain('[Red]')
    expect(body).toContain('[Yellow]')
    expect(body).toContain('Richmond')
    // No south section — single direction
    expect(body).not.toContain('\u25BC')
  })

  it('shows arriving soon marker', () => {
    const trains: TrainArrival[] = [
      { route: 'Red', direction: 'N', stopId: '901201', arrivalTime: now + 120, terminal: 'Richmond' },
    ]
    const body = renderBody(bartStation, 'N', trains, 0, 1)
    expect(body).toContain('\u25B6') // ▶
  })

  it('shows no live data when empty', () => {
    const body = renderBody(bartStation, 'N', [], 0, 1)
    expect(body).toContain('No live data')
  })

  it('shows compact progress bar for multiple pages', () => {
    const body = renderBody(bartStation, 'N', [], 2, 5)
    expect(body).toContain('3/5')
    expect(body).toContain('\u2501') // ━
  })

  it('omits progress bar for single page', () => {
    const body = renderBody(bartStation, 'N', [], 0, 1)
    expect(body).not.toContain('1/1')
  })

  it('limits to MAX_TRAINS (6)', () => {
    const trains: TrainArrival[] = Array.from({ length: 10 }, (_, i) => ({
      route: 'Red', direction: 'N' as const, stopId: '901201',
      arrivalTime: now + (i + 1) * 300, terminal: 'Richmond',
    }))
    const body = renderBody(bartStation, 'N', trains, 0, 1)
    const lines = body.split('\n').filter((l) => l.includes('[Red]'))
    expect(lines.length).toBe(6)
  })
})

describe('renderLoading', () => {
  it('shows loading message', () => {
    expect(renderLoading()).toContain('Loading')
  })
})

describe('renderNoStations', () => {
  it('shows empty state', () => {
    const text = renderNoStations()
    expect(text).toContain('No stations added')
    expect(text).toContain('phone')
  })
})
