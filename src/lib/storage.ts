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

// ── Favorites (per-platform entries) ──

const FAVORITES_KEY = 'glass-transit-511-favorites-v2'

export async function getFavorites(): Promise<FavoriteEntry[]> {
  const raw = await getItem(FAVORITES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as FavoriteEntry[]
  } catch {
    return []
  }
}

export async function saveFavorites(entries: FavoriteEntry[]): Promise<void> {
  await setItem(FAVORITES_KEY, JSON.stringify(entries))
}

/** Add a station — creates entries for all platforms by default. */
export async function addStation(
  stationId: string,
  numPlatforms: number
): Promise<FavoriteEntry[]> {
  const favs = await getFavorites()
  for (let i = 0; i < numPlatforms; i++) {
    const exists = favs.some(
      (f) => f.stationId === stationId && f.platform === i
    )
    if (!exists) favs.push({ stationId, platform: i })
  }
  await saveFavorites(favs)
  return favs
}

/** Remove a specific platform entry. */
export async function removeFavorite(
  stationId: string,
  platform: number
): Promise<FavoriteEntry[]> {
  const favs = (await getFavorites()).filter(
    (f) => !(f.stationId === stationId && f.platform === platform)
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

/** Check if a specific platform is favorited. */
export function isFavorited(
  favorites: FavoriteEntry[],
  stationId: string,
  platform: number
): boolean {
  return favorites.some((f) => f.stationId === stationId && f.platform === platform)
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
