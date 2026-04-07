import { describe, it, expect } from 'vitest'
import { renderHeader, renderBody, renderLoading, renderNoStations } from '../display'
import type { Station, TrainArrival } from '../../types'

const bartStation: Station = {
  id: 'bart-901209',
  name: 'Montgomery Street',
  stops: ['901201', '901202'],
  agency: 'BA',
  routes: ['Blue', 'Green', 'Red', 'Yellow'],
  lat: 37.789,
  lng: -122.401,
  platformLabels: ['Platform 1', 'Platform 2'],
  platformMap: { '901201': 0, '901202': 1 },
}

const muniStation: Station = {
  id: 'muni-metro-embarcadero',
  name: 'Embarcadero',
  stops: ['16992', '17217'],
  agency: 'SF',
  routes: ['J', 'K', 'L', 'M', 'N'],
  lat: 37.793,
  lng: -122.396,
  platformLabels: ['Inbound', 'Outbound'],
  platformMap: { '16992': 0, '17217': 1 },
}

const now = 1700000000

describe('renderHeader', () => {
  it('shows BART station with platform label', () => {
    const h = renderHeader(bartStation, 0)
    expect(h).toContain('Montgomery Street')
    expect(h).toContain('(BART)')
    expect(h).toContain('Platform 1')
  })

  it('shows Muni station with platform label', () => {
    const h = renderHeader(muniStation, 1)
    expect(h).toContain('Embarcadero')
    expect(h).toContain('(Muni)')
    expect(h).toContain('Outbound')
  })

  it('truncates long station names', () => {
    const longStation = { ...bartStation, name: 'A'.repeat(50) }
    const h = renderHeader(longStation, 0)
    expect(h.length).toBeLessThanOrEqual(42)
    expect(h).toContain('..')
  })
})

describe('renderBody', () => {
  it('shows trains for a single platform', () => {
    const trains: TrainArrival[] = [
      { route: 'Red', stopId: '901201', arrivalTime: now + 180, terminal: 'Richmond' },
      { route: 'Yellow', stopId: '901201', arrivalTime: now + 600, terminal: 'Antioch' },
    ]
    const body = renderBody(bartStation, 0, trains, 0, 3)
    expect(body).toContain('Platform 1')
    expect(body).toContain('[Red]')
    expect(body).toContain('[Yellow]')
    expect(body).toContain('Richmond')
  })

  it('shows arriving soon marker', () => {
    const trains: TrainArrival[] = [
      { route: 'Red', stopId: '901201', arrivalTime: now + 120, terminal: 'Richmond' },
    ]
    const body = renderBody(bartStation, 0, trains, 0, 1)
    expect(body).toContain('\u25B6')
  })

  it('shows no live data when empty', () => {
    const body = renderBody(bartStation, 0, [], 0, 1)
    expect(body).toContain('No live data')
  })

  it('shows compact progress bar for multiple pages', () => {
    const body = renderBody(bartStation, 0, [], 2, 5)
    expect(body).toContain('3/5')
    expect(body).toContain('\u2501')
  })

  it('limits to MAX_TRAINS (6)', () => {
    const trains: TrainArrival[] = Array.from({ length: 10 }, (_, i) => ({
      route: 'Red', stopId: '901201',
      arrivalTime: now + (i + 1) * 300, terminal: 'Richmond',
    }))
    const body = renderBody(bartStation, 0, trains, 0, 1)
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
    expect(renderNoStations()).toContain('No stations added')
  })
})
