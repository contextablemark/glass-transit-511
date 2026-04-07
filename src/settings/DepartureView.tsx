/**
 * Phone-side departure display.
 * Shows real-time departures grouped by platform for each saved station.
 */

import { useState, useEffect, useRef } from 'react'
import type { Station, StationArrivals, FavoriteEntry } from '../types'
import { getStation } from './search'
import { getSettings, uniqueStationIds } from '../lib/storage'
import { buildFetchOptions, agenciesForStations } from '../data/feed-urls'
import { extractArrivals } from '../transit/feeds'
import { minutesUntil, isArrivingSoon } from '../lib/time'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity

interface Props {
  favorites: FavoriteEntry[]
}

export function DepartureView({ favorites }: Props) {
  const [arrivals, setArrivals] = useState<Map<string, StationArrivals>>(new Map())
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [error, setError] = useState<string>('')

  const stationIds = uniqueStationIds(favorites)
  const stations = stationIds.map((id) => getStation(id)).filter((s): s is Station => !!s)
  const favKey = favorites.map((f) => `${f.stationId}:${f.platform}`).join(',')

  useEffect(() => {
    if (stations.length === 0) return
    let cancelled = false

    async function refresh() {
      try {
        const settings = await getSettings()
        const agencies = agenciesForStations(stations)
        const feedMap = new Map<string, FeedEntity[]>()

        for (const agency of agencies) {
          const { url, init } = buildFetchOptions(settings, agency)
          const resp = await fetch(url, init)
          if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`)
          const buffer = await resp.arrayBuffer()
          let bytes = new Uint8Array(buffer)
          if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.slice(3)
          const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes)
          feedMap.set(agency, feed.entity || [])
        }
        if (cancelled) return

        const newArrivals = new Map<string, StationArrivals>()
        for (const station of stations) {
          const entities = feedMap.get(station.agency) || []
          newArrivals.set(station.id, extractArrivals(station, entities))
        }
        setArrivals(newArrivals)
        setError('')
        setLastUpdate(new Date().toLocaleTimeString())
      } catch (err) {
        if (cancelled) return
        console.error('[DepartureView] fetch failed:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    refresh()
    const timer = setInterval(refresh, 60_000)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favKey])

  if (stations.length === 0) return null

  return (
    <div>
      {error && (
        <div style={{
          padding: '0.5rem 0.75rem', background: '#3a1a1a',
          borderRadius: '0.375rem', color: '#ff6666', fontSize: '0.8rem', marginBottom: '0.5rem',
        }}>{error}</div>
      )}

      {stations.map((station) => {
        const stationArrivals = arrivals.get(station.id)
        return (
          <StationCard key={station.id} station={station} arrivals={stationArrivals} />
        )
      })}

      {lastUpdate && (
        <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center', marginTop: '0.5rem' }}>
          Last updated: {lastUpdate}
        </div>
      )}
    </div>
  )
}

function StationCard({ station, arrivals }: { station: Station; arrivals?: StationArrivals }) {
  const agency = station.agency === 'BA' ? 'BART' : 'Muni'
  const now = Math.floor(Date.now() / 1000)

  return (
    <div style={{
      background: '#252540', borderRadius: '0.5rem',
      padding: '0.75rem', marginBottom: '0.5rem',
    }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        {station.name}
        <span style={{
          background: station.agency === 'BA' ? '#0066cc' : '#cc3333',
          color: '#fff', padding: '0 0.3rem', borderRadius: '0.2rem',
          marginLeft: '0.5rem', fontSize: '0.65rem', fontWeight: 600,
        }}>{agency}</span>
      </div>

      {!arrivals ? (
        <div style={{ color: '#999', fontSize: '0.8rem' }}>Loading...</div>
      ) : (
        station.platformLabels.map((label, platIdx) => (
          <div key={platIdx}>
            {platIdx > 0 && <div style={{ borderTop: '1px solid #333', margin: '0.4rem 0' }} />}
            <PlatformGroup
              label={label}
              trains={arrivals.platforms[platIdx] || []}
              now={now}
            />
          </div>
        ))
      )}
    </div>
  )
}

function PlatformGroup({
  label, trains, now,
}: {
  label: string
  trains: import('../types').TrainArrival[]
  now: number
}) {
  const display = trains.slice(0, 5)

  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>{label}</div>
      {display.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#666', paddingLeft: '0.5rem' }}>No live data</div>
      ) : (
        display.map((t, i) => {
          const mins = minutesUntil(t.arrivalTime, now)
          const soon = isArrivingSoon(t.arrivalTime, now)
          return (
            <div key={`${t.route}-${t.arrivalTime}-${i}`} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '0.15rem 0 0.15rem 0.5rem', fontSize: '0.85rem',
            }}>
              <span>
                <span style={{ fontWeight: 600, color: soon ? '#ffcc00' : '#e0e0e0' }}>
                  [{t.route}]
                </span>
                {' '}{t.terminal}
              </span>
              <span style={{ color: soon ? '#ffcc00' : '#999', fontWeight: soon ? 600 : 400 }}>
                {mins === 0 ? 'now' : `${mins}m`}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
