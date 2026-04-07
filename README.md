# Glass Transit

Real-time BART and Muni departure times on [Even Realities G2](https://www.evenrealities.com/) smart glasses.

Scroll between saved stations, see upcoming trains in both directions, and never miss your ride.

## How It Works

- **Glasses display**: Two-container layout showing station name + departures grouped by direction, with arriving-soon markers and a station progress bar
- **Phone UI**: Search and save stations, configure settings — changes sync to glasses
- **Data**: [GTFS-RT](https://gtfs.org/documentation/realtime/reference/) protobuf feeds from [511.org](https://511.org/open-data/transit), decoded client-side with `gtfs-realtime-bindings`
- **Proxy**: Purpose-built Cloudflare Worker handles CORS and keeps the 511.org API key server-side

### Glasses Display

```
Montgomery Street (BART) ★

▲ Richmond
▶[Red] Richmond              2 min - 3:42
 [Yel] Antioch               6 min - 3:46
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
▼ Millbrae/SFO
 [Red] Millbrae             12 min - 3:52
 [Blu] Daly City             8 min - 3:48
━━━━━━━━━━━━━━━━━━━━━━ 2/5
```

### Input

| Gesture | Action |
|---------|--------|
| Scroll down | Next station |
| Scroll up | Previous station |
| Tap | Refresh |
| Double-tap | Exit app |

## Setup

### Prerequisites

- Node.js 20+
- A free [511.org API key](https://511.org/open-data)

### Local Development

```bash
git clone https://github.com/contextablemark/glass-transit.git
cd glass-transit
npm install

# Add your API key (server-side only, never sent to browser)
cp .env.example .env
# Edit .env: API_511_KEY=your-key-here

npm run dev
```

Open http://localhost:5174 to see the phone settings UI. The Vite dev proxy handles 511.org requests locally.

### Deploy to G2

```bash
# Sideload via QR code
npm run qr

# Or package for Even Hub
npm run pack
```

### Transit Proxy (Production)

The app requires a proxy because 511.org doesn't send CORS headers. See [proxy/README.md](proxy/README.md) for Cloudflare Worker setup.

The proxy supports two modes:
- **Community GET** — baked-in API key, CDN-cached (30s), shared by all users
- **BYOK POST** — user sends their own key in the request body

## Project Structure

```
glass-transit/
  proxy/                    # Cloudflare Worker (transit proxy)
  scripts/
    build-stations.ts       # Generates stations.json from 511.org GTFS static data
  src/
    data/
      stations.json         # Bundled BART + Muni station data (303 stations)
      feed-urls.ts          # 511.org feed URL builder
    transit/
      feeds.ts              # GTFS-RT protobuf fetch + decode
      cache.ts              # Per-agency feed cache with TTL
      rate-limiter.ts       # Sliding-window rate limiter (60 req/hr)
    glasses/
      boot.ts               # Glasses mode entry point + display lifecycle
      display.ts            # Station arrivals → G2 text rendering
      input.ts              # SDK event handler (tap, scroll, quirk workarounds)
      stations.ts           # Favorites manager + arrival extraction
    settings/
      SettingsApp.tsx        # React settings UI root
      StationSearch.tsx      # Fuzzy station search
      FavoritesList.tsx      # Saved stations with reorder/delete
      SettingsPanel.tsx      # Proxy URL, API key, refresh interval
      search.ts             # Search algorithm (abbreviation expansion, aliases)
    lib/
      storage.ts            # Bridge/localStorage persistence
      time.ts               # Arrival time formatting
```

## Station Data

The app bundles 303 stations (50 BART, 253 Muni rail) in `src/data/stations.json`. This data is generated from 511.org GTFS static feeds.

To regenerate:

```bash
API_511_KEY=your-key npm run build-stations
```

A GitHub Action (manual trigger) is also available to update station data — requires `API_511_KEY` in repo secrets.

## Architecture Notes

- **GTFS-RT over SIRI**: Uses the universal GTFS-RT protocol (same as [SubwayLens](https://github.com/laolao91/subwaylens) for NYC). Other transit agencies can be supported by changing feed URLs and station data.
- **Per-agency feed caching**: 511.org has one feed per agency. Two fetches (BART + Muni) cover all saved stations per refresh cycle.
- **Rate limiting**: 511.org allows 60 requests per hour. The app tracks requests in a sliding window and pauses when near the limit.
- **Dual-mode bootstrap**: Settings UI always renders (React). Glasses mode activates only inside the Even App WebView.
- **UTF-8 BOM handling**: 511.org prepends BOM to some responses — stripped before protobuf decode.

## Adapting for Other Transit Agencies

This app is designed to be adapted for any transit agency that publishes GTFS-RT feeds:

1. Create a new `stations.json` from the agency's GTFS static data
2. Update `feed-urls.ts` with the agency's GTFS-RT endpoint
3. Adjust `display.ts` direction labels if needed
4. Deploy your own proxy with the agency's API key (if required)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 5174) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run tests (Vitest) |
| `npm run build-stations` | Regenerate station data from 511.org |
| `npm run qr` | QR code for G2 sideloading |
| `npm run pack` | Package as .ehpk for Even Hub |

## Credits

Inspired by [SubwayLens](https://github.com/laolao91/subwaylens) — NYC subway arrivals for G2.

Transit data provided by [511.org](https://511.org/open-data/transit) via the [GTFS-RT](https://gtfs.org/documentation/realtime/reference/) standard.

## License

MIT
