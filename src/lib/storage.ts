/**
 * Storage wrapper — bridge.setLocalStorage / getLocalStorage with
 * window.localStorage fallback for simulator/browser testing.
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Settings, FavoriteEntry } from '../types'
import { DEFAULT_SETTINGS } from '../types'

let bridge: EvenAppBridge | null = null

export function initStorage(b: EvenAppBridge): void {
  bridge = b
}

async function setItem(key: string, value: string): Promise<void> {
  if (bridge) {
    try {
      await bridge.setLocalStorage(key, value)
      return
    } catch { /* fall through */ }
  }
  try { window.localStorage.setItem(key, value) } catch { /* noop */ }
}

async function getItem(key: string): Promise<string | null> {
  if (bridge) {
    try {
      const val = await bridge.getLocalStorage(key)
      if (val !== undefined && val !== null && val !== '') return val as string
    } catch { /* fall through */ }
  }
  try { return window.localStorage.getItem(key) } catch { return null }
}

// ── Favorites (per-direction entries) ──

const FAVORITES_KEY = 'glass-transit-511-favorites'

export async function getFavorites(): Promise<FavoriteEntry[]> {
  const raw = await getItem(FAVORITES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Migration: if old format (string[]), convert to FavoriteEntry[]
    if (parsed.length > 0 && typeof parsed[0] === 'string') {
      const migrated: FavoriteEntry[] = []
      for (const id of parsed as string[]) {
        migrated.push({ stationId: id, direction: 'N' })
        migrated.push({ stationId: id, direction: 'S' })
      }
      await saveFavorites(migrated)
      return migrated
    }
    return parsed as FavoriteEntry[]
  } catch {
    return []
  }
}

export async function saveFavorites(entries: FavoriteEntry[]): Promise<void> {
  await setItem(FAVORITES_KEY, JSON.stringify(entries))
}

/** Add a station — creates both direction entries by default. */
export async function addStation(stationId: string): Promise<FavoriteEntry[]> {
  const favs = await getFavorites()
  const hasN = favs.some((f) => f.stationId === stationId && f.direction === 'N')
  const hasS = favs.some((f) => f.stationId === stationId && f.direction === 'S')
  if (!hasN) favs.push({ stationId, direction: 'N' })
  if (!hasS) favs.push({ stationId, direction: 'S' })
  await saveFavorites(favs)
  return favs
}

/** Remove a specific direction entry. */
export async function removeFavorite(
  stationId: string,
  direction: 'N' | 'S'
): Promise<FavoriteEntry[]> {
  const favs = (await getFavorites()).filter(
    (f) => !(f.stationId === stationId && f.direction === direction)
  )
  await saveFavorites(favs)
  return favs
}

/** Remove all entries for a station. */
export async function removeStation(stationId: string): Promise<FavoriteEntry[]> {
  const favs = (await getFavorites()).filter((f) => f.stationId !== stationId)
  await saveFavorites(favs)
  return favs
}

/** Check if a specific direction is favorited. */
export function isFavorited(
  favorites: FavoriteEntry[],
  stationId: string,
  direction: 'N' | 'S'
): boolean {
  return favorites.some((f) => f.stationId === stationId && f.direction === direction)
}

/** Get unique station IDs from favorites. */
export function uniqueStationIds(favorites: FavoriteEntry[]): string[] {
  return [...new Set(favorites.map((f) => f.stationId))]
}

// ── Settings ──

const SETTINGS_KEY = 'glass-transit-511-settings'

export async function getSettings(): Promise<Settings> {
  const raw = await getItem(SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setItem(SETTINGS_KEY, JSON.stringify(settings))
}
