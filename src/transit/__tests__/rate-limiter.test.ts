import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  canFetch,
  recordRequest,
  requestsRemaining,
  requestsMade,
  resetRateLimiter,
} from '../rate-limiter'

beforeEach(() => {
  resetRateLimiter()
  vi.restoreAllMocks()
})

describe('rate-limiter', () => {
  it('allows fetching when no requests made', () => {
    expect(canFetch()).toBe(true)
    expect(requestsRemaining()).toBe(60)
    expect(requestsMade()).toBe(0)
  })

  it('tracks requests', () => {
    recordRequest()
    recordRequest()
    expect(requestsMade()).toBe(2)
    expect(requestsRemaining()).toBe(58)
  })

  it('blocks when near limit', () => {
    // Record 58 requests (limit=60, buffer=2)
    for (let i = 0; i < 58; i++) recordRequest()
    expect(canFetch()).toBe(false)
    expect(requestsRemaining()).toBe(2)
  })

  it('allows custom limits', () => {
    for (let i = 0; i < 8; i++) recordRequest()
    expect(canFetch(10)).toBe(false)
    expect(canFetch(20)).toBe(true)
  })

  it('prunes old timestamps', () => {
    const realNow = Date.now()
    // Record request "in the past" by mocking
    vi.spyOn(Date, 'now').mockReturnValue(realNow - 3700000) // > 1 hour ago
    recordRequest()
    vi.spyOn(Date, 'now').mockReturnValue(realNow) // back to now
    expect(requestsMade()).toBe(0) // pruned
  })

  it('reset clears all', () => {
    recordRequest()
    recordRequest()
    resetRateLimiter()
    expect(requestsMade()).toBe(0)
  })
})
