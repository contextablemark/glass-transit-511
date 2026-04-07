/**
 * Favorites list — shows saved stations with delete and drag-to-reorder.
 * Simplified reorder: up/down buttons instead of drag handles
 * (drag-and-drop in WebView is unreliable).
 */

import { getStation } from './search'

interface Props {
  favoriteIds: string[]
  onReorder: (ids: string[]) => void
  onRemove: (id: string) => void
}

export function FavoritesList({ favoriteIds, onReorder, onRemove }: Props) {
  if (favoriteIds.length === 0) {
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
    const ids = [...favoriteIds]
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    onReorder(ids)
  }

  const moveDown = (index: number) => {
    if (index >= favoriteIds.length - 1) return
    const ids = [...favoriteIds]
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    onReorder(ids)
  }

  return (
    <div>
      {favoriteIds.map((id, index) => {
        const station = getStation(id)
        if (!station) return null

        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              background: '#252540',
              borderRadius: '0.375rem',
              marginBottom: '0.25rem',
            }}
          >
            {/* Reorder buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              marginRight: '0.5rem',
              gap: '0.1rem',
            }}>
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: index === 0 ? '#444' : '#999',
                  cursor: index === 0 ? 'default' : 'pointer',
                  fontSize: '0.7rem',
                  padding: '0 0.2rem',
                  lineHeight: 1,
                }}
              >
                &#x25B2;
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index >= favoriteIds.length - 1}
                style={{
                  background: 'none',
                  border: 'none',
                  color: index >= favoriteIds.length - 1 ? '#444' : '#999',
                  cursor: index >= favoriteIds.length - 1 ? 'default' : 'pointer',
                  fontSize: '0.7rem',
                  padding: '0 0.2rem',
                  lineHeight: 1,
                }}
              >
                &#x25BC;
              </button>
            </div>

            {/* Station info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem' }}>{station.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#999' }}>
                <span style={{
                  background: station.agency === 'BA' ? '#0066cc' : '#cc3333',
                  color: '#fff',
                  padding: '0 0.3rem',
                  borderRadius: '0.2rem',
                  marginRight: '0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                }}>
                  {station.agency === 'BA' ? 'BART' : 'Muni'}
                </span>
                {station.routes.join(', ')}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={() => onRemove(id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#cc3333',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '0 0.3rem',
              }}
            >
              &#x2715;
            </button>
          </div>
        )
      })}
    </div>
  )
}
