/**
 * Storage wrapper — bridge.setLocalStorage / getLocalStorage with
 * window.localStorage fallback for simulator/browser testing.
 * Same pattern as SubwayLens.
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Settings } from '../types'
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

// ── Favorites ──

const FAVORITES_KEY = 'glass-transit-favorites'

export async function getFavorites(): Promise<string[]> {
  const raw = await getItem(FAVORITES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveFavorites(ids: string[]): Promise<void> {
  await setItem(FAVORITES_KEY, JSON.stringify(ids))
}

export async function addFavorite(id: string): Promise<string[]> {
  const favs = await getFavorites()
  if (!favs.includes(id)) favs.push(id)
  await saveFavorites(favs)
  return favs
}

export async function removeFavorite(id: string): Promise<string[]> {
  const favs = (await getFavorites()).filter((f) => f !== id)
  await saveFavorites(favs)
  return favs
}

// ── Settings ──

const SETTINGS_KEY = 'glass-transit-settings'

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
