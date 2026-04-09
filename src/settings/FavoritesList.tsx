/**
 * Favorites list — shows saved stations with per-platform toggles.
 * Each toggled-on platform becomes a page on the glasses.
 */

import type { FavoriteEntry } from '../types'
import { getStation } from './search'
import { uniqueStationIds, isFavorited } from '../lib/storage'

interface Props {
  favorites: FavoriteEntry[]
  onReorder: (entries: FavoriteEntry[]) => void
  onRemovePlatform: (stationId: string, platform: number) => void
  onAddPlatform: (stationId: string, platform: number) => void
  onRemoveStation: (stationId: string) => void
}

export function FavoritesList({
  favorites,
  onReorder,
  onRemovePlatform,
  onAddPlatform,
  onRemoveStation,
}: Props) {
  const stationIds = uniqueStationIds(favorites)

  if (stationIds.length === 0) {
    return (
      <div style={{
        padding: '1rem',
        color: '#666',
        textAlign: 'center',
        fontSize: '0.875rem',
        background: '#252540',
        borderRadius: '0.5rem',
      }}>
        No stations saved yet. Search below to add some.
      </div>
    )
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const ids = [...stationIds]
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    const reordered: FavoriteEntry[] = []
    for (const id of ids) {
      for (const fav of favorites) {
        if (fav.stationId === id) reordered.push(fav)
      }
    }
    onReorder(reordered)
  }

  const moveDown = (index: number) => {
    if (index >= stationIds.length - 1) return
    const ids = [...stationIds]
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    const reordered: FavoriteEntry[] = []
    for (const id of ids) {
      for (const fav of favorites) {
        if (fav.stationId === id) reordered.push(fav)
      }
    }
    onReorder(reordered)
  }

  return (
    <div>
      {stationIds.map((stationId, index) => {
        const station = getStation(stationId)
        if (!station) return null
        const agency = station.agency === 'BA' ? 'BART' : 'Muni'

        return (
          <div key={stationId} style={{
            background: '#252540',
            borderRadius: '0.5rem',
            padding: '0.6rem 0.75rem',
            marginBottom: '0.375rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', marginRight: '0.5rem', gap: '0.1rem' }}>
                <button onClick={() => moveUp(index)} disabled={index === 0}
                  style={arrowStyle(index === 0)}>&#x25B2;</button>
                <button onClick={() => moveDown(index)} disabled={index >= stationIds.length - 1}
                  style={arrowStyle(index >= stationIds.length - 1)}>&#x25BC;</button>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.9rem' }}>{station.name}</span>
                <span style={{
                  background: station.agency === 'BA' ? '#0066cc' : '#cc3333',
                  color: '#fff', padding: '0 0.3rem', borderRadius: '0.2rem',
                  marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 600,
                }}>{agency}</span>
              </div>
              <button onClick={() => onRemoveStation(stationId)} style={{
                background: 'none', border: 'none', color: '#cc3333',
                cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.2rem',
              }}>&#x2715;</button>
            </div>

            {/* Platform toggles — 2-column grid for 3+ platforms */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: station.platformLabels.length > 2 ? '1fr 1fr' : `repeat(${station.platformLabels.length}, 1fr)`,
              gap: '0.5rem',
              marginTop: '0.4rem',
              paddingLeft: '1.5rem',
            }}>
              {station.platformLabels.map((label, platIdx) => {
                const active = isFavorited(favorites, stationId, platIdx)
                return (
                  <button
                    key={platIdx}
                    onClick={() =>
                      active
                        ? onRemovePlatform(stationId, platIdx)
                        : onAddPlatform(stationId, platIdx)
                    }
                    style={{
                      flex: 1,
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.75rem',
                      background: active ? '#334' : '#1a1a2e',
                      color: active ? '#e0e0e0' : '#666',
                      border: `1px solid ${active ? '#556' : '#333'}`,
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {active ? '\u2605 ' : '\u2606 '}{label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function arrowStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'none', border: 'none',
    color: disabled ? '#444' : '#999',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '0.7rem', padding: '0 0.2rem', lineHeight: 1,
  }
}
