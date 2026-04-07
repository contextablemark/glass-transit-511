import { describe, it, expect } from 'vitest'
import {
  renderHeader,
  renderBody,
  renderLoading,
  renderNoStations,
} from '../display'
import type { Station, StationArrivals } from '../../types'

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
  it('shows BART station with agency', () => {
    const h = renderHeader(bartStation, false)
    expect(h).toContain('Montgomery Street')
    expect(h).toContain('(BART)')
    expect(h).not.toContain('\u2605')
  })

  it('shows Muni station with star when favorite', () => {
    const h = renderHeader(muniStation, true)
    expect(h).toContain('Embarcadero')
    expect(h).toContain('(Muni)')
    expect(h).toContain('\u2605')
  })

  it('truncates long station names', () => {
    const longStation = { ...bartStation, name: 'A'.repeat(50) }
    const h = renderHeader(longStation, false)
    expect(h.length).toBeLessThanOrEqual(42)
    expect(h).toContain('..')
  })
})

describe('renderBody', () => {
  it('shows departures in both directions', () => {
    const arrivals: StationArrivals = {
      stationId: bartStation.id,
      north: [
        { route: 'Red', direction: 'N', stopId: '901201', arrivalTime: now + 180, terminal: 'Richmond' },
        { route: 'Yellow', direction: 'N', stopId: '901201', arrivalTime: now + 600, terminal: 'Antioch' },
      ],
      south: [
        { route: 'Blue', direction: 'S', stopId: '901202', arrivalTime: now + 300, terminal: 'Daly City' },
      ],
      fetchedAt: now,
    }

    const body = renderBody(bartStation, arrivals, 0, 3)
    expect(body).toContain('\u25B2') // ▲ north
    expect(body).toContain('\u25BC') // ▼ south
    expect(body).toContain('[Red]')
    expect(body).toContain('[Blue]')
    expect(body).toContain('Richmond')
    expect(body).toContain('Daly City')
    // arriving soon marker for 3min arrival
    expect(body).toContain('\u25B6') // ▶
  })

  it('shows no live data when empty', () => {
    const arrivals: StationArrivals = {
      stationId: bartStation.id,
      north: [],
      south: [],
      fetchedAt: now,
    }
    const body = renderBody(bartStation, arrivals, 0, 1)
    expect(body).toContain('No live data')
  })

  it('shows progress bar for multiple stations', () => {
    const arrivals: StationArrivals = {
      stationId: bartStation.id,
      north: [],
      south: [],
      fetchedAt: now,
    }
    const body = renderBody(bartStation, arrivals, 2, 5)
    expect(body).toContain('3/5')
    expect(body).toContain('\u2501') // ━
  })

  it('omits progress bar for single station', () => {
    const arrivals: StationArrivals = {
      stationId: bartStation.id,
      north: [],
      south: [],
      fetchedAt: now,
    }
    const body = renderBody(bartStation, arrivals, 0, 1)
    expect(body).not.toContain('1/1')
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
