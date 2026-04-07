import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCached, setCached, clearCache, isFresh } from '../cache'

beforeEach(() => {
  clearCache()
})

describe('cache', () => {
  const mockEntities = [
    { id: '1', tripUpdate: { trip: { routeId: 'Red-N' } } },
  ] as any[]

  it('returns null for empty cache', () => {
    expect(getCached('BA', 60000)).toBeNull()
  })

  it('stores and retrieves entities', () => {
    setCached('BA', mockEntities)
    const result = getCached('BA', 60000)
    expect(result).toEqual(mockEntities)
  })

  it('returns null when expired', () => {
    setCached('BA', mockEntities)
    // Move time forward past TTL
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 70000)
    expect(getCached('BA', 60000)).toBeNull()
    vi.restoreAllMocks()
  })

  it('keeps data for different agencies separate', () => {
    const sfEntities = [{ id: '2' }] as any[]
    setCached('BA', mockEntities)
    setCached('SF', sfEntities)
    expect(getCached('BA', 60000)).toEqual(mockEntities)
    expect(getCached('SF', 60000)).toEqual(sfEntities)
  })

  it('isFresh returns correct values', () => {
    expect(isFresh('BA', 60000)).toBe(false)
    setCached('BA', mockEntities)
    expect(isFresh('BA', 60000)).toBe(true)
  })

  it('clearCache removes all entries', () => {
    setCached('BA', mockEntities)
    clearCache()
    expect(getCached('BA', 60000)).toBeNull()
  })
})
