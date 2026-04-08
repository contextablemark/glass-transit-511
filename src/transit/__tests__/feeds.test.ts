import { describe, it, expect } from 'vitest'
import { extractArrivals } from '../feeds'
import type { Station } from '../../types'

const station: Station = {
  id: 'bart-902409',
  name: 'San Leandro',
  stops: ['902401', '902402'],
  agency: 'BA',
  routes: ['Blue', 'Green', 'Orange'],
  lat: 37.722,
  lng: -122.161,
  platformLabels: ['Platform 1', 'Platform 2'],
  platformMap: { '902401': 0, '902402': 1 },
}

const now = Math.floor(Date.now() / 1000)

/**
 * Create a trip entity with the station stop plus a subsequent stop
 * (so the station stop isn't the last — avoids the terminating filter).
 */
function makeTripEntity(opts: {
  routeId: string
  directionId: number
  stopId: string
  arrivalTime: number
}) {
  return {
    id: `trip-${Math.random()}`,
    tripUpdate: {
      trip: {
        routeId: opts.routeId,
        directionId: opts.directionId,
        tripId: `t-${Math.random()}`,
      },
      stopTimeUpdate: [
        {
          stopId: opts.stopId,
          arrival: { time: BigInt(opts.arrivalTime) },
        },
        {
          // Next stop after this station (not in our station's stop set)
          stopId: '999999',
          arrival: { time: BigInt(opts.arrivalTime + 300) },
        },
      ],
    },
  } as any
}

describe('extractArrivals', () => {
  it('groups by platform stop_id, not direction_id', () => {
    const entities = [
      // Blue-N (dir=0) at platform 902401 (platform 0)
      makeTripEntity({ routeId: 'Blue-N', directionId: 0, stopId: '902401', arrivalTime: now + 180 }),
      // Orange-S (dir=1) at platform 902401 (also platform 0 — same geographic direction)
      makeTripEntity({ routeId: 'Orange-S', directionId: 1, stopId: '902401', arrivalTime: now + 300 }),
      // Blue-S (dir=1) at platform 902402 (platform 1)
      makeTripEntity({ routeId: 'Blue-S', directionId: 1, stopId: '902402', arrivalTime: now + 240 }),
    ]

    const result = extractArrivals(station, entities)
    expect(result.platforms[0]).toHaveLength(2)
    expect(result.platforms[0][0].route).toBe('Blue')
    expect(result.platforms[0][1].route).toBe('Orange')
    expect(result.platforms[1]).toHaveLength(1)
    expect(result.platforms[1][0].route).toBe('Blue')
  })

  it('uses route terminal from GTFS static data', () => {
    const entities = [
      makeTripEntity({ routeId: 'Orange-N', directionId: 0, stopId: '902402', arrivalTime: now + 180 }),
    ]
    const result = extractArrivals(station, entities)
    expect(result.platforms[1][0].terminal).toBe('Richmond')
  })

  it('strips BART direction suffix from route display name', () => {
    const entities = [
      makeTripEntity({ routeId: 'Green-S', directionId: 1, stopId: '902402', arrivalTime: now + 120 }),
    ]
    const result = extractArrivals(station, entities)
    expect(result.platforms[1][0].route).toBe('Green')
  })

  it('filters out past arrivals', () => {
    const entities = [
      makeTripEntity({ routeId: 'Blue-N', directionId: 0, stopId: '902401', arrivalTime: now - 60 }),
      makeTripEntity({ routeId: 'Blue-N', directionId: 0, stopId: '902401', arrivalTime: now + 180 }),
    ]
    const result = extractArrivals(station, entities)
    expect(result.platforms[0]).toHaveLength(1)
  })

  it('sorts by arrival time within each platform', () => {
    const entities = [
      makeTripEntity({ routeId: 'Blue-N', directionId: 0, stopId: '902401', arrivalTime: now + 600 }),
      makeTripEntity({ routeId: 'Green-N', directionId: 0, stopId: '902401', arrivalTime: now + 180 }),
    ]
    const result = extractArrivals(station, entities)
    expect(result.platforms[0][0].route).toBe('Green')
    expect(result.platforms[0][1].route).toBe('Blue')
  })

  it('filters out trains terminating at the station', () => {
    // Trip where station stop is the LAST stop (terminating)
    const terminating = {
      id: 'term-1',
      tripUpdate: {
        trip: { routeId: 'Blue-S', directionId: 1, tripId: 'term-1' },
        stopTimeUpdate: [
          { stopId: '999888', arrival: { time: BigInt(now + 60) } },
          { stopId: '902401', arrival: { time: BigInt(now + 180) } }, // last stop = terminates
        ],
      },
    } as any

    // Trip where station stop is NOT the last stop (passes through)
    const passing = makeTripEntity({
      routeId: 'Blue-N', directionId: 0, stopId: '902401', arrivalTime: now + 300,
    })

    const result = extractArrivals(station, [terminating, passing])
    expect(result.platforms[0]).toHaveLength(1) // only the passing train
    expect(result.platforms[0][0].route).toBe('Blue')
  })
})
