/**
 * Station search — fuzzy matching over bundled station data.
 * Adapted from SubwayLens search.ts for Bay Area stations.
 */

import stationsData from '../data/stations.json'
import type { Station } from '../types'

const allStations = stationsData as unknown as Station[]

/**
 * Search aliases — common names that differ from official GTFS names.
 */
const SEARCH_ALIASES: Array<{ keywords: string[]; stationId: string }> = [
  // BART
  { keywords: ['embarcadero', 'embarc'], stationId: 'bart-901169' },
  { keywords: ['civic center', 'civic ctr', 'un plaza'], stationId: 'bart-901409' },
  { keywords: ['powell'], stationId: 'bart-901309' },
  { keywords: ['montgomery'], stationId: 'bart-901209' },
  { keywords: ['16th mission', '16th st mission'], stationId: 'bart-901509' },
  { keywords: ['24th mission', '24th st mission'], stationId: 'bart-901609' },
  { keywords: ['sfo', 'airport'], stationId: 'bart-907109' },
  { keywords: ['oakland airport', 'oak airport'], stationId: 'bart-907409' },
  { keywords: ['downtown berkeley', 'cal'], stationId: 'bart-904209' },
  { keywords: ['balboa park'], stationId: 'bart-901809' },
  { keywords: ['glen park'], stationId: 'bart-901709' },
  { keywords: ['west oakland'], stationId: 'bart-901109' },
  // Muni Metro
  { keywords: ['embarcadero metro', 'muni embarcadero'], stationId: 'muni-metro-embarcadero' },
  { keywords: ['castro metro', 'muni castro'], stationId: 'muni-metro-castro' },
  { keywords: ['forest hill'], stationId: 'muni-metro-forest-hill' },
]

/** Abbreviation normalization — bidirectional equivalences. */
const ABBREV_MAP: Record<string, string[]> = {
  'st': ['street'],
  'street': ['st'],
  'av': ['ave', 'avenue'],
  'ave': ['av', 'avenue'],
  'avenue': ['av', 'ave'],
  'sq': ['square'],
  'square': ['sq'],
  'blvd': ['boulevard'],
  'boulevard': ['blvd'],
  'ctr': ['center', 'centre'],
  'center': ['ctr', 'centre'],
  'hts': ['heights'],
  'heights': ['hts'],
  'jct': ['junction'],
  'junction': ['jct'],
  'pkwy': ['parkway'],
  'parkway': ['pkwy'],
  'dr': ['drive'],
  'drive': ['dr'],
  'pl': ['place'],
  'place': ['pl'],
}

/** Strip ordinal suffixes: "42nd" → "42" */
function stripOrdinals(text: string): string {
  return text.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1')
}

function normalize(text: string): string {
  return stripOrdinals(text.toLowerCase()).replace(/[-/]/g, ' ')
}

function expandAbbreviations(word: string): string[] {
  const variants = ABBREV_MAP[word]
  return variants ? [word, ...variants] : [word]
}

function fuzzyMatch(queryWords: string[], stationName: string): boolean {
  const normalizedStation = normalize(stationName)
  return queryWords.every((queryWord) => {
    const variants = expandAbbreviations(queryWord)
    return variants.some((variant) => normalizedStation.includes(variant))
  })
}

/**
 * Search stations by name (fuzzy matching with abbreviation normalization).
 * Also checks search aliases for common alternate names.
 */
export function searchStations(query: string, limit = 20): Station[] {
  if (!query.trim()) return []
  const q = query.toLowerCase().trim()
  const results: Station[] = []
  const addedIds = new Set<string>()

  // Check aliases first (skip for very short queries to avoid false matches)
  for (const alias of SEARCH_ALIASES) {
    if (results.length >= limit) break
    if (q.length >= 3 && alias.keywords.some((kw) => kw.includes(q) || q.includes(kw))) {
      const s = allStations.find((st) => st.id === alias.stationId)
      if (s && !addedIds.has(s.id)) {
        results.push(s)
        addedIds.add(s.id)
      }
    }
  }

  const normalizedQuery = normalize(q)
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean)

  for (const s of allStations) {
    if (addedIds.has(s.id)) continue

    // Exact substring match (fast path)
    if (s.name.toLowerCase().includes(q)) {
      results.push(s)
      addedIds.add(s.id)
      if (results.length >= limit) break
      continue
    }

    // Fuzzy match with abbreviation expansion
    if (fuzzyMatch(queryWords, s.name)) {
      results.push(s)
      addedIds.add(s.id)
      if (results.length >= limit) break
    }
  }

  return results
}

/** Get a station by ID. */
export function getStation(id: string): Station | undefined {
  return allStations.find((s) => s.id === id)
}

/** Get all stations. */
export function getAllStations(): Station[] {
  return allStations
}
