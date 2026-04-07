import { describe, it, expect } from 'vitest'
import { extractArrivals } from '../feeds'
import type { Station } from '../../types'

const station: Station = {
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

const now = Math.floor(Date.now() / 1000)

function makeTripEntity(opts: {
  routeId: string
  directionId: number
  stops: Array<{ stopId: string; arrivalTime: number }>
}) {
  return {
    id: `trip-${Math.random()}`,
    tripUpdate: {
      trip: {
        routeId: opts.routeId,
        directionId: opts.directionId,
        tripId: `t-${Math.random()}`,
      },
      stopTimeUpdate: opts.stops.map((s) => ({
        stopId: s.stopId,
        arrival: { time: BigInt(s.arrivalTime) },
      })),
    },
  } as any
}

describe('extractArrivals', () => {
  it('extracts arrivals matching station stop IDs', () => {
    const entities = [
      makeTripEntity({
        routeId: 'Red-N',
        directionId: 0,
        stops: [
          { stopId: '901201', arrivalTime: now + 180 },
          { stopId: '900101', arrivalTime: now + 600 }, // different station
        ],
      }),
    ]

    const result = extractArrivals(station, entities)
    expect(result.north).toHaveLength(1)
    expect(result.north[0].route).toBe('Red')
    expect(result.north[0].direction).toBe('N')
    expect(result.south).toHaveLength(0)
  })

  it('separates north and south by direction_id', () => {
    const entities = [
      makeTripEntity({
        routeId: 'Red-N',
        directionId: 0,
        stops: [{ stopId: '901201', arrivalTime: now + 180 }],
      }),
      makeTripEntity({
        routeId: 'Red-S',
        directionId: 1,
        stops: [{ stopId: '901202', arrivalTime: now + 300 }],
      }),
    ]

    const result = extractArrivals(station, entities)
    expect(result.north).toHaveLength(1)
    expect(result.south).toHaveLength(1)
  })

  it('filters out past arrivals', () => {
    const entities = [
      makeTripEntity({
        routeId: 'Red-N',
        directionId: 0,
        stops: [
          { stopId: '901201', arrivalTime: now - 60 }, // past
          { stopId: '901201', arrivalTime: now + 180 }, // future
        ],
      }),
    ]

    const result = extractArrivals(station, entities)
    expect(result.north).toHaveLength(1)
    expect(result.north[0].arrivalTime).toBe(now + 180)
  })

  it('strips BART direction suffix from route_id', () => {
    const entities = [
      makeTripEntity({
        routeId: 'Blue-S',
        directionId: 1,
        stops: [{ stopId: '901202', arrivalTime: now + 120 }],
      }),
    ]

    const result = extractArrivals(station, entities)
    expect(result.south[0].route).toBe('Blue')
  })

  it('sorts by arrival time', () => {
    const entities = [
      makeTripEntity({
        routeId: 'Red-N',
        directionId: 0,
        stops: [{ stopId: '901201', arrivalTime: now + 600 }],
      }),
      makeTripEntity({
        routeId: 'Blue-N',
        directionId: 0,
        stops: [{ stopId: '901201', arrivalTime: now + 180 }],
      }),
    ]

    const result = extractArrivals(station, entities)
    expect(result.north[0].route).toBe('Blue')
    expect(result.north[1].route).toBe('Red')
  })

  it('returns empty for unmatched stops', () => {
    const entities = [
      makeTripEntity({
        routeId: 'Red-N',
        directionId: 0,
        stops: [{ stopId: '999999', arrivalTime: now + 180 }],
      }),
    ]

    const result = extractArrivals(station, entities)
    expect(result.north).toHaveLength(0)
    expect(result.south).toHaveLength(0)
  })
})
