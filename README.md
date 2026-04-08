# Glass Transit 511

Real-time BART and Muni departure times on [Even Realities G2](https://www.evenrealities.com/) smart glasses.

Scroll between saved station platforms, see upcoming trains with car counts, and never miss your ride.

## How It Works

- **Glasses display**: Each page shows one platform for one station — up to 6 trains per page with arrival times and car count
- **Phone UI**: Tabbed interface — Departures (live view), My Stations (search/manage), Settings
- **BART data**: [BART Legacy API](https://api.bart.gov/) — richer data including car count, platform number, and destination names. Direct fetch, no proxy needed (CORS supported).
- **Muni data**: [GTFS-RT](https://gtfs.org/documentation/realtime/reference/) protobuf feeds from [511.org](https://511.org/open-data/transit), decoded client-side. Requires a CORS proxy since 511.org doesn't send CORS headers.
- **BART fallback**: If the BART Legacy API is unavailable or no BART key is configured, BART stations fall back to GTFS-RT via 511.org (same as Muni).

### Glasses Display

Each saved platform gets its own page:

```
San Leandro (BART) Platform 1

Platform 1
▶[Orange] Berryessa      3m | 6 car
 [Green] Berryessa      11m | 6 car
 [Blue] Dublin/Pleasan  28m | 6 car
━━━━━━━━━━━━━━━━━━━━ 1/4
```

### Input

| Gesture | Action |
|---------|--------|
| Scroll down | Next page |
| Scroll up | Previous page |
| Tap | Refresh |
| Double-tap | Exit app |

### Per-Platform Favorites

When you add a station, both platforms are favorited by default. Each becomes its own page on the glasses. On the phone UI, you can toggle platforms independently — useful when you only care about one direction for your commute. The Departures tab filters to show only your favorited platforms.

## Data Sources

| Agency | Primary source | Proxy needed? | Car count? |
|--------|---------------|---------------|------------|
| BART | [BART Legacy API](https://api.bart.gov/) (api.bart.gov) | No (CORS supported) | Yes (6 or 9 cars) |
| Muni | [511.org GTFS-RT](https://511.org/open-data/transit) | Yes (no CORS headers) | No |
| BART (fallback) | 511.org GTFS-RT | Yes | No |

Each source has its own configurable refresh interval: BART API (15/30/60s), GTFS-RT (30/60/120s).

## Setup

### Prerequisites

- Node.js 20+

### API Keys

| Key | Where to get it | Required? |
|-----|----------------|-----------|
| BART API key | [api.bart.gov/api/register.aspx](https://api.bart.gov/api/register.aspx) | Optional but recommended — enables car count and richer BART data |
| 511.org API key | [511.org/open-data](https://511.org/open-data) | Only if you want Muni stations or BART GTFS-RT fallback |

No API keys are baked into the app. Users register and enter their own.

### Local Development

```bash
git clone https://github.com/contextablemark/glass-transit-511.git
cd glass-transit-511
npm install

# Add your 511.org API key for the Vite dev proxy (server-side only)
cp .env.example .env
# Edit .env: API_511_KEY=your-key-here

npm run dev
```

Open http://localhost:5174 to see the phone UI. In dev mode:
- BART API requests route through a Vite dev proxy for terminal-visible logging
- GTFS-RT requests route through a Vite dev proxy that injects the 511.org key from `.env`
- No external proxy or Cloudflare Worker needed

Enter your BART API key in Settings to enable BART Legacy API data.

### Deploy to G2

```bash
# Sideload via QR code (use --ip to override detected IP)
npm run qr
npm run qr -- --ip 192.168.1.100

# Or package for Even Hub
npm run pack
```

### CORS Proxy (Production — Muni only)

A CORS proxy is required **only for Muni stations** (and BART GTFS-RT fallback). BART stations work without any proxy via the BART Legacy API.

If you only use BART stations and have a BART API key, you can skip this entirely.

See [proxy/README.md](proxy/README.md) for Cloudflare Worker setup. The proxy supports two modes:
- **Community GET** — baked-in 511.org API key, CDN-cached (30s), shared by all users
- **BYOK POST** — user sends their own 511.org key in the request body

## Project Structure

```
glass-transit-511/
  proxy/                    # Cloudflare Worker (CORS proxy for 511.org GTFS-RT)
  scripts/
    build-stations.ts       # Generates stations.json from 511.org GTFS static data
  src/
    data/
      stations.json         # Bundled BART + Muni station data (303 stations)
      route-terminals.json  # Route → terminal name mapping (BART + Muni)
      feed-urls.ts          # 511.org GTFS-RT feed URL builder
    transit/
      bart-api.ts           # BART Legacy API client (car count, platform, destinations)
      feeds.ts              # GTFS-RT protobuf fetch + decode (Muni + BART fallback)
      cache.ts              # Per-agency feed cache with TTL
      rate-limiter.ts       # Sliding-window rate limiter for 511.org (60 req/hr)
    glasses/
      boot.ts               # Glasses mode entry point + display lifecycle
      display.ts            # Single-platform page rendering for G2
      input.ts              # SDK event handler (tap, scroll, quirk workarounds)
      stations.ts           # Per-platform page manager (BART API primary, GTFS-RT fallback)
    settings/
      SettingsApp.tsx        # Tabbed React UI (Departures, My Stations, Settings)
      StationSearch.tsx      # Fuzzy station search
      FavoritesList.tsx      # Stations with per-platform toggle buttons
      SettingsPanel.tsx      # BART key, intervals, Advanced (proxy/GTFS-RT config)
      DepartureView.tsx      # Live departure display filtered by favorited platforms
      search.ts             # Search algorithm (abbreviation expansion, aliases)
    lib/
      storage.ts            # Bridge/localStorage persistence
      time.ts               # Arrival time formatting
```

## Station Data

The app bundles 303 stations (50 BART, 253 Muni rail) in `src/data/stations.json`, plus 147 route → terminal name mappings in `route-terminals.json`. Station data includes platform mappings so arrivals are grouped by physical platform (not GTFS direction_id, which is unreliable at BART stations where multiple lines share platforms).

To regenerate from 511.org GTFS static feeds:

```bash
API_511_KEY=your-key npm run build-stations
```

A GitHub Action (manual trigger) is also available — requires `API_511_KEY` in repo secrets.

## Architecture Notes

- **Dual data source**: BART Legacy API is primary for BART (richer data, no proxy needed). GTFS-RT via 511.org is used for Muni and as BART fallback. Each has independent refresh intervals and caching.
- **Platform-based grouping**: Arrivals are grouped by physical platform stop_id, not GTFS `direction_id`. At BART stations, different lines share platforms despite having different direction_ids (e.g. Blue-N and Orange-S both use Platform 1 at San Leandro).
- **Terminal names**: BART terminals come from the Legacy API's `destination` field. Muni terminals are derived from the most common last stop per route+direction in GTFS static data.
- **Per-platform pages**: Each favorited platform is its own glasses page — gives room for 6 trains without needing a direction separator.
- **Rate limiting**: 511.org allows 60 requests per hour. The app tracks requests in a sliding window and pauses when near the limit. The BART Legacy API has no documented rate limit.
- **Auto-sync**: Glasses display updates automatically when stations are added, removed, or platform toggles change on the phone.
- **Dual-mode bootstrap**: Phone settings UI always renders (React). Glasses mode activates only inside the Even App WebView.
- **UTF-8 BOM handling**: 511.org prepends BOM to some protobuf responses — stripped before decode.

## Adapting for Other Transit Agencies

This app can be adapted for any transit agency:

- **Agency with its own real-time API** (like BART): Add a client module similar to `bart-api.ts` that fetches directly. No proxy needed if the API sends CORS headers.
- **Agency with GTFS-RT feeds**: Update `feed-urls.ts` with the agency's endpoint, generate new `stations.json` and `route-terminals.json` from their GTFS static data, and deploy a CORS proxy if needed.
- **Station data**: Run `scripts/build-stations.ts` with the agency's GTFS feed, or create `stations.json` manually.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 5174) with BART + GTFS-RT proxy logging |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run tests (Vitest) |
| `npm run build-stations` | Regenerate station data from 511.org GTFS |
| `npm run qr` | QR code for G2 sideloading |
| `npm run pack` | Package as .ehpk for Even Hub |

## Credits

Inspired by [SubwayLens](https://github.com/laolao91/subwaylens) — NYC subway arrivals for G2.

BART data provided by [BART Legacy API](https://api.bart.gov/). Muni data provided by [511.org](https://511.org/open-data/transit) via [GTFS-RT](https://gtfs.org/documentation/realtime/reference/).

## License

MIT
