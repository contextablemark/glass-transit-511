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

export function SettingsApp() {
  const [tab, setTab] = useState<Tab>('departures')
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([])
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    async function load() {
      const [favs, s] = await Promise.all([getFavorites(), getSettings()])
      setFavorites(favs)
      setSettings(s)
      setLoading(false)
    }
    load()
  }, [])

  const handleReorder = useCallback(async (entries: FavoriteEntry[]) => {
    setFavorites(entries)
    await saveFavorites(entries)
  }, [])

  const handleRemovePlatform = useCallback(async (stationId: string, platform: number) => {
    const next = await removeFavorite(stationId, platform)
    setFavorites(next)
  }, [])

  const handleRemoveStation = useCallback(async (stationId: string) => {
    const next = await removeStation(stationId)
    setFavorites(next)
  }, [])

  const handleAddStation = useCallback(async (stationId: string) => {
    const station = getStation(stationId)
    const numPlatforms = station?.platformLabels.length ?? 2
    const next = await addStation(stationId, numPlatforms)
    setFavorites(next)
  }, [])

  const handleAddPlatform = useCallback(async (stationId: string, platform: number) => {
    const favs = await getFavorites()
    const exists = favs.some((f) => f.stationId === stationId && f.platform === platform)
    if (!exists) {
      favs.push({ stationId, platform })
      await saveFavorites(favs)
      setFavorites(favs)
    }
  }, [])

  const handleSettingsChange = useCallback(async (next: Settings) => {
    setSettings(next)
    await saveSettings(next)
  }, [])

  const handleSync = useCallback(() => {
    window.dispatchEvent(new CustomEvent('glass-transit:sync'))
    setToastMsg('Sent to glasses!')
    setTimeout(() => setToastMsg(''), 2000)
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
          <div style={{ paddingBottom: '5rem' }}>
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

            {/* Send to Glasses */}
            <div style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '1rem',
              background: '#1a1a2e',
              borderTop: '1px solid #333',
            }}>
              <button onClick={handleSync} style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: 600,
                background: '#e0e0e0',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}>
                Send to Glasses
              </button>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <SettingsPanel settings={settings} onChange={handleSettingsChange} />
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: tab === 'stations' ? '5rem' : '1rem',
          left: '1rem',
          right: '1rem',
          padding: '0.75rem',
          background: '#333',
          color: '#e0e0e0',
          borderRadius: '0.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          zIndex: 20,
        }}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
