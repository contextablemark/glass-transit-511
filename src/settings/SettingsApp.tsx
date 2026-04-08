/**
 * Root React component for the phone settings page.
 * Tabbed UI: Departures | My Stations | Settings
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getFavorites,
  saveFavorites,
  addStation,
  removeStation,
  removeFavorite,
  getSettings,
  saveSettings,
} from '../lib/storage'
import type { Settings, FavoriteEntry } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { FavoritesList } from './FavoritesList'
import { StationSearch } from './StationSearch'
import { SettingsPanel } from './SettingsPanel'
import { DepartureView } from './DepartureView'
import { getStation } from './search'

type Tab = 'departures' | 'stations' | 'settings'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'departures', label: 'Departures' },
  { id: 'stations', label: 'My Stations' },
  { id: 'settings', label: 'Settings' },
]

/** Notify glasses to reload stations */
function syncToGlasses() {
  window.dispatchEvent(new CustomEvent('glass-transit:sync'))
}

export function SettingsApp() {
  const [tab, setTab] = useState<Tab>('departures')
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([])
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [favs, s] = await Promise.all([getFavorites(), getSettings()])

      // Allow URL query params to pre-populate settings (e.g. ?BART_API_KEY=...)
      const params = new URLSearchParams(window.location.search)
      const bartKey = params.get('BART_API_KEY')
      if (bartKey && !s.bartApiKey) {
        s.bartApiKey = bartKey
        await saveSettings(s)
      }

      setFavorites(favs)
      setSettings(s)
      setLoading(false)
    }
    load()
  }, [])

  const handleReorder = useCallback(async (entries: FavoriteEntry[]) => {
    setFavorites(entries)
    await saveFavorites(entries)
    syncToGlasses()
  }, [])

  const handleRemovePlatform = useCallback(async (stationId: string, platform: number) => {
    const next = await removeFavorite(stationId, platform)
    setFavorites(next)
    syncToGlasses()
  }, [])

  const handleRemoveStation = useCallback(async (stationId: string) => {
    const next = await removeStation(stationId)
    setFavorites(next)
    syncToGlasses()
  }, [])

  const handleAddStation = useCallback(async (stationId: string) => {
    const station = getStation(stationId)
    const numPlatforms = station?.platformLabels.length ?? 2
    const next = await addStation(stationId, numPlatforms)
    setFavorites(next)
    syncToGlasses()
  }, [])

  const handleAddPlatform = useCallback(async (stationId: string, platform: number) => {
    const favs = await getFavorites()
    const exists = favs.some((f) => f.stationId === stationId && f.platform === platform)
    if (!exists) {
      favs.push({ stationId, platform })
      await saveFavorites(favs)
      setFavorites(favs)
      syncToGlasses()
    }
  }, [])

  const handleSettingsChange = useCallback(async (next: Settings) => {
    setSettings(next)
    await saveSettings(next)
  }, [])

  if (loading) {
    return <div style={{ padding: '2rem', color: '#999', textAlign: 'center' }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #333',
        background: '#1a1a2e',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '0.7rem 0',
              fontSize: '0.85rem',
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? '#e0e0e0' : '#666',
              background: 'none',
              border: 'none',
              borderBottom: tab === id ? '2px solid #e0e0e0' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem' }}>
        {tab === 'departures' && (
          favorites.length > 0 ? (
            <DepartureView favorites={favorites} />
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
              No stations saved. Go to My Stations to add some.
            </div>
          )
        )}

        {tab === 'stations' && (
          <div>
            <FavoritesList
              favorites={favorites}
              onReorder={handleReorder}
              onRemovePlatform={handleRemovePlatform}
              onAddPlatform={handleAddPlatform}
              onRemoveStation={handleRemoveStation}
            />

            <div style={{
              fontSize: '1rem',
              fontWeight: 600,
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
              color: '#e0e0e0',
            }}>
              Add Station
            </div>
            <StationSearch favorites={favorites} onAdd={handleAddStation} />
          </div>
        )}

        {tab === 'settings' && (
          <SettingsPanel settings={settings} onChange={handleSettingsChange} />
        )}
      </div>
    </div>
  )
}
