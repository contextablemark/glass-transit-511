/**
 * Phone-side departure display.
 *
 * BART stations: tries legacy API first (if key set), falls back to GTFS-RT.
 * Muni stations: GTFS-RT via proxy.
 */

import { useState, useEffect, useRef } from 'react'
import type { Station, StationArrivals, FavoriteEntry } from '../types'
import { getStation } from './search'
import { getSettings, uniqueStationIds } from '../lib/storage'
import { fetchBartArrivals } from '../transit/bart-api'
import { buildFetchOptions, agenciesForStations } from '../data/feed-urls'
import { extractArrivals } from '../transit/feeds'
import { isArrivingSoon } from '../lib/time'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity

interface Props {
  favorites: FavoriteEntry[]
}

export function DepartureView({ favorites }: Props) {
  const [arrivals, setArrivals] = useState<Map<string, StationArrivals>>(new Map())
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [error, setError] = useState<string>('')
  const bartTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gtfsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stationIds = uniqueStationIds(favorites)
  const stations = stationIds.map((id) => getStation(id)).filter((s): s is Station => !!s)
  const favKey = favorites.map((f) => `${f.stationId}:${f.platform}`).join(',')

  useEffect(() => {
    if (stations.length === 0) return
    let cancelled = false

    const bartStations = stations.filter((s) => s.agency === 'BA')
    const muniStations = stations.filter((s) => s.agency === 'SF')

    async function refreshBart() {
      try {
        const settings = await getSettings()
        if (!settings.bartApiKey || bartStations.length === 0) return

        for (const station of bartStations) {
          if (cancelled) return
          const result = await fetchBartArrivals(station, settings)
          if (result && !cancelled) {
            setArrivals((prev) => {
              const next = new Map(prev)
              next.set(station.id, result)
              return next
            })
          }
        }
        if (!cancelled) setLastUpdate(new Date().toLocaleTimeString())
      } catch (err) {
        if (!cancelled) console.error('[DepartureView] BART fetch failed:', err)
      }
    }

    async function refreshGtfs() {
      try {
        const settings = await getSettings()
        // GTFS-RT for Muni + BART stations without BART API key
        const gtfsStations = [
          ...muniStations,
          ...(settings.bartApiKey ? [] : bartStations),
        ]
        if (gtfsStations.length === 0) return
        // In dev mode, empty proxyBaseUrl works (Vite proxy at /transit/...).
        // In prod, need either proxyBaseUrl or gtfsApiKey.
        const isDev = import.meta.env.DEV
        if (!isDev && !settings.proxyBaseUrl && !settings.gtfsApiKey) return

        const agencies = agenciesForStations(gtfsStations)
        const feedMap = new Map<string, FeedEntity[]>()

        for (const agency of agencies) {
          const { url, init } = buildFetchOptions(settings, agency)
          const resp = await fetch(url, init)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const buffer = await resp.arrayBuffer()
          let bytes = new Uint8Array(buffer)
          if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.slice(3)
          const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes)
          feedMap.set(agency, feed.entity || [])
        }
        if (cancelled) return

        for (const station of gtfsStations) {
          const entities = feedMap.get(station.agency) || []
          const result = extractArrivals(station, entities)
          setArrivals((prev) => {
            const next = new Map(prev)
            next.set(station.id, result)
            return next
          })
        }
        if (!cancelled) {
          setError('')
          setLastUpdate(new Date().toLocaleTimeString())
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[DepartureView] GTFS-RT fetch failed:', err)
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    // Initial fetch
    refreshBart()
    refreshGtfs()

    // Separate timers
    getSettings().then((settings) => {
      if (cancelled) return
      if (settings.bartApiKey && bartStations.length > 0) {
        bartTimerRef.current = setInterval(refreshBart, settings.bartRefreshSec * 1000)
      }
      if (muniStations.length > 0 || (!settings.bartApiKey && bartStations.length > 0)) {
        gtfsTimerRef.current = setInterval(refreshGtfs, settings.gtfsRefreshSec * 1000)
      }
    })

    return () => {
      cancelled = true
      if (bartTimerRef.current) clearInterval(bartTimerRef.current)
      if (gtfsTimerRef.current) clearInterval(gtfsTimerRef.current)
    }
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
        const activePlatforms = favorites
          .filter((f) => f.stationId === station.id)
          .map((f) => f.platform)
        return (
          <StationCard
            key={station.id}
            station={station}
            arrivals={arrivals.get(station.id)}
            platforms={activePlatforms}
          />
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

function StationCard({
  station, arrivals, platforms,
}: {
  station: Station
  arrivals?: StationArrivals
  platforms: number[]  // which platform indices to show
}) {
  const agency = station.agency === 'BA' ? 'BART' : 'Muni'

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
        {arrivals?.source && (
          <span style={{
            color: '#666', fontSize: '0.6rem', marginLeft: '0.3rem',
          }}>via {arrivals.source}</span>
        )}
      </div>

      {!arrivals ? (
        <div style={{ color: '#999', fontSize: '0.8rem' }}>Loading...</div>
      ) : (
        platforms.map((platIdx, i) => (
          <div key={platIdx}>
            {i > 0 && <div style={{ borderTop: '1px solid #333', margin: '0.4rem 0' }} />}
            <PlatformGroup
              label={station.platformLabels[platIdx] || `Platform ${platIdx + 1}`}
              trains={arrivals.platforms[platIdx] || []}
            />
          </div>
        ))
      )}
    </div>
  )
}

function PlatformGroup({
  label, trains,
}: {
  label: string
  trains: import('../types').TrainArrival[]
}) {
  const display = trains.slice(0, 5)

  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>{label}</div>
      {display.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#666', paddingLeft: '0.5rem' }}>No live data</div>
      ) : (
        display.map((t, i) => {
          const soon = isArrivingSoon(t.arrivalTime)
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
              <span style={{
                color: soon ? '#ffcc00' : '#999',
                fontWeight: soon ? 600 : 400,
                whiteSpace: 'nowrap',
              }}>
                {t.minutesAway === 0 ? 'Now' : `${t.minutesAway}m`}
                {t.cars != null && (
                  <span style={{ color: '#888', fontWeight: 400 }}>{' | '}{t.cars} car</span>
                )}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
