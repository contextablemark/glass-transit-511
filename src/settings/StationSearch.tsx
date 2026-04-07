/**
 * Station search component — fuzzy search over bundled station data.
 * Debounced input with search results and add buttons.
 */

import { useState, useRef, useCallback } from 'react'
import { searchStations } from './search'
import type { Station } from '../types'

interface Props {
  favoriteIds: string[]
  onAdd: (id: string) => void
}

const DEBOUNCE_MS = 200

export function StationSearch({ favoriteIds, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Station[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const favSet = new Set(favoriteIds)

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setResults(searchStations(value))
      }, DEBOUNCE_MS)
    },
    []
  )

  return (
    <div>
      <input
        type="text"
        placeholder="Search by station name..."
        value={query}
        onChange={handleInput}
        style={{
          width: '100%',
          padding: '0.6rem 0.75rem',
          fontSize: '0.95rem',
          background: '#252540',
          color: '#e0e0e0',
          border: '1px solid #444',
          borderRadius: '0.5rem',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {results.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          {results.map((station) => (
            <div
              key={station.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#252540',
                borderRadius: '0.375rem',
                marginBottom: '0.25rem',
              }}
            >
              <div>
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
              {favSet.has(station.id) ? (
                <span style={{ color: '#666', fontSize: '1.2rem' }}>
                  &#x2713;
                </span>
              ) : (
                <button
                  onClick={() => onAdd(station.id)}
                  style={{
                    background: 'none',
                    border: '1px solid #666',
                    color: '#e0e0e0',
                    borderRadius: '50%',
                    width: '1.8rem',
                    height: '1.8rem',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
