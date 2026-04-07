/**
 * Root React component for the phone settings page.
 * Sections: My Stations, Add Station (search), Settings.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getFavorites,
  saveFavorites,
  addFavorite,
  removeFavorite,
  getSettings,
  saveSettings,
} from '../lib/storage'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { FavoritesList } from './FavoritesList'
import { StationSearch } from './StationSearch'
import { SettingsPanel } from './SettingsPanel'
import { DepartureView } from './DepartureView'

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: '1.1rem',
      fontWeight: 600,
      marginTop: '1.5rem',
      marginBottom: '0.75rem',
      color: '#e0e0e0',
    }}>
      {children}
    </div>
  )
}

export function SettingsApp() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    async function load() {
      const [favs, s] = await Promise.all([getFavorites(), getSettings()])
      setFavoriteIds(favs)
      setSettings(s)
      setLoading(false)
    }
    load()
  }, [])

  const handleReorder = useCallback(async (ids: string[]) => {
    setFavoriteIds(ids)
    await saveFavorites(ids)
  }, [])

  const handleRemove = useCallback(async (id: string) => {
    const next = await removeFavorite(id)
    setFavoriteIds(next)
  }, [])

  const handleAdd = useCallback(async (id: string) => {
    const next = await addFavorite(id)
    setFavoriteIds(next)
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
    return (
      <div style={{ padding: '2rem', color: '#999', textAlign: 'center' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Glass Transit</h1>
        <p style={{ color: '#999', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
          BART &amp; Muni departures for G2
        </p>
      </div>

      {/* Departures */}
      {favoriteIds.length > 0 && (
        <>
          <SectionLabel>Departures</SectionLabel>
          <DepartureView favoriteIds={favoriteIds} />
        </>
      )}

      {/* My Stations */}
      <SectionLabel>My Stations</SectionLabel>
      <FavoritesList
        favoriteIds={favoriteIds}
        onReorder={handleReorder}
        onRemove={handleRemove}
      />

      {/* Add Station */}
      <SectionLabel>Add Station</SectionLabel>
      <StationSearch
        favoriteIds={favoriteIds}
        onAdd={handleAdd}
      />

      {/* Settings */}
      <SectionLabel>Settings</SectionLabel>
      <SettingsPanel
        settings={settings}
        onChange={handleSettingsChange}
      />

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
        <button
          onClick={handleSync}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            background: '#e0e0e0',
            color: '#1a1a2e',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          Send to Glasses
        </button>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '5rem',
          left: '1rem',
          right: '1rem',
          padding: '0.75rem',
          background: '#333',
          color: '#e0e0e0',
          borderRadius: '0.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
        }}>
          {toastMsg}
        </div>
      )}

      <p style={{
        color: '#666',
        textAlign: 'center',
        fontSize: '0.7rem',
        marginTop: '2rem',
      }}>
        v0.1.0 &middot; Changes auto-save
      </p>
    </div>
  )
}
