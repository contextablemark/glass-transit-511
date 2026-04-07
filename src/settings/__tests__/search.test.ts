import { describe, it, expect } from 'vitest'
import { searchStations, getStation } from '../search'

describe('searchStations', () => {
  it('returns empty for empty query', () => {
    expect(searchStations('')).toEqual([])
    expect(searchStations('   ')).toEqual([])
  })

  it('finds BART stations by name', () => {
    const results = searchStations('Montgomery')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toContain('Montgomery')
    expect(results[0].agency).toBe('BA')
  })

  it('finds Muni Metro stations', () => {
    const results = searchStations('Embarcadero')
    expect(results.length).toBeGreaterThan(0)
    const metro = results.find((s) => s.id.includes('muni-metro'))
    expect(metro).toBeDefined()
  })

  it('handles abbreviations (st → street)', () => {
    const results = searchStations('montgomery st')
    expect(results.length).toBeGreaterThan(0)
  })

  it('matches aliases', () => {
    const results = searchStations('sfo')
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.some((s) => s.name.toLowerCase().includes('airport'))
    ).toBe(true)
  })

  it('limits results', () => {
    const results = searchStations('st', 5)
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('finds stations case-insensitively', () => {
    const lower = searchStations('powell')
    const upper = searchStations('POWELL')
    expect(lower.length).toBeGreaterThan(0)
    expect(lower[0].id).toBe(upper[0].id)
  })
})

describe('getStation', () => {
  it('returns station by ID', () => {
    const s = getStation('bart-901209')
    expect(s).toBeDefined()
    expect(s?.name).toContain('Montgomery')
  })

  it('returns undefined for unknown ID', () => {
    expect(getStation('nonexistent')).toBeUndefined()
  })
})
