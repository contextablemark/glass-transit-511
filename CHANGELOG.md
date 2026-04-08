# Changelog

## [0.5.0] - 2026-04-08 (first production release)

### Changed

- **Tabbed phone UI**: Replaced single-page layout with three tabs — Departures (default), My Stations, Settings. Tab bar is sticky at top.
- **Removed title bar**: "Glass Transit 511" header removed from phone UI — the Even App already shows the app name.
- **"Send to Glasses" moved**: Only appears on the My Stations tab (not globally).
- **"Add Station" moved**: Search is now under the favorites list on the My Stations tab.

### Added

- **Server-side BART API logging**: In dev mode, BART API requests route through Vite proxy for terminal-visible logging alongside GTFS-RT logs.
- **Departures filtered by favorites**: Departures tab only shows platforms that are toggled on in My Stations. Unfavoriting a platform hides it from both the glasses and the phone.
- **Auto-sync to glasses**: Glasses display updates automatically when stations are added, removed, reordered, or platform toggles change. No manual "Send to Glasses" button needed.

### Removed

- **"Send to Glasses" button**: Replaced by automatic sync on every favorites change.

### Developer

- **Client-to-terminal log relay**: `devLog()` helper sends client-side messages to the Vite terminal via `/dev-log` endpoint. Used for glasses boot diagnostics (hasFlutter, bridge status).

## [0.4.0] - 2026-04-07

### Added

- **BART Legacy API support**: Uses api.bart.gov for BART stations — richer data including car count, platform number, proper destination names, and line colors. No CORS proxy needed. Falls back to GTFS-RT if unavailable or key not set.
- **Car count display**: Shows train length on glasses (`[Red] Richmond | 9    3m`) and phone UI for BART trains.
- **Separate refresh intervals**: BART API (default 30s) and GTFS-RT (default 60s) poll independently.
- **Restructured settings**: BART API key (optional but recommended) is its own field. GTFS-RT proxy/key under collapsible "Advanced" section.

### Changed

- **No baked-in API keys**: BART demo key is not included in the code. Users register their own at api.bart.gov. Without a BART key, BART stations fall back to GTFS-RT (requires proxy).
- **Simplified time format**: Glasses display shows compact "5m" / "now" instead of "5 min - 3:42".
- **Right-aligned times**: Time values padded to consistent width for visual alignment on G2 display.

### Fixed

- **Redundant BART GTFS-RT fetches**: When BART API key is set, no longer fetches BART data via GTFS-RT. Only Muni triggers GTFS-RT requests.
- **Dev mode GTFS-RT**: Empty `proxyBaseUrl` in dev mode no longer blocks GTFS-RT fetches (Vite dev proxy handles `/transit/...` automatically).

## [0.3.0] - 2026-04-07

### Changed

- **Platform-based grouping**: Arrivals are grouped by physical platform stop_id instead of GTFS `direction_id`. Fixes incorrect direction assignment at stations where different BART lines have different `direction_id` values but share the same platform (e.g. San Leandro: Blue-N + Orange-S both on Platform 1).
- **BART platform labels**: Directions labeled "Platform 1" / "Platform 2" instead of destination names, since platforms serve multiple lines with different terminals.
- **Terminal names from GTFS static data**: Route terminals now come from `route_long_name` in routes.txt (e.g. "Richmond", "Daly City") instead of the last `stopTimeUpdate` entry, which could be incomplete (e.g. showing "Milpitas" instead of "Berryessa").
- **Favorites model v2**: `FavoriteEntry.direction` (N/S) replaced with `FavoriteEntry.platform` (number). New storage key (`-v2`) avoids conflicts with old data.
- **Bundled route-terminals.json**: 82 → 147 route terminal mappings for BART and Muni.

### Fixed

- **Muni terminal names**: Muni routes don't have "X to Y" in `route_long_name`, so terminals were showing the route letter (e.g. "[N] N"). Now derives terminals from the most common last stop per route+direction in GTFS static trip data (e.g. "[N] Ocean Beach", "[N] King St & 4th St").

## [0.2.0] - 2026-04-07

### Changed

- **Renamed** from "Glass Transit" to "Glass Transit 511" (repo: glass-transit-511)
- **Per-direction favorites**: Each direction is now its own glasses page. Adding a station favorites both directions by default; each can be toggled independently on the phone UI. This gives more room per page (6 trains vs 3) and eliminates the direction separator.
- **Single-direction glasses pages**: Each page shows one direction with up to 6 trains, direction arrow in header, and compact progress bar
- **Compact progress bar**: Fixed progress bar to fit on one line (was wrapping to two)

### Added

- Phone departure view: live departures for all saved stations with auto-refresh
- Per-direction toggle buttons in favorites list (★/☆ per direction)
- Diagnostic logging in Vite transit proxy (key load status, request/response)
- Old favorites format auto-migration (string[] → FavoriteEntry[])

### Fixed

- Favorites not persisting across refreshes in Even App WebView (storage timing)
- CORS OPTIONS handler ordering in Vite proxy (was unreachable)

## [0.1.0] - 2026-04-07

### Added

- Initial release targeting BART and SF Muni via 511.org GTFS-RT feeds
- Glasses display with two-container layout: station header + departure list grouped by direction
- Arriving-soon marker (▶) for trains under 4 minutes away
- Station progress bar for navigating between saved stations
- Scroll up/down to switch stations, tap to refresh, double-tap to exit
- Phone settings UI (React) with fuzzy station search, favorites list with reorder, and settings panel
- Bundled station data: 50 BART stations + 253 Muni rail stops (303 total)
- Station search with abbreviation expansion (st↔street, av↔avenue) and aliases for common names
- GTFS-RT protobuf decoding via `gtfs-realtime-bindings`
- Per-agency feed caching (one fetch per agency covers all saved stations)
- Sliding-window rate limiter respecting 511.org's 60 req/hr limit
- Hybrid transit proxy (Cloudflare Worker): GET with baked-in key (CDN-cacheable) + POST with user key (BYOK)
- Vite dev proxy for local development (API key in `.env`, server-side only)
- `scripts/build-stations.ts` to regenerate station data from 511.org GTFS static feeds
- GitHub Action (manual trigger) for station data updates
- Dual-mode bootstrap: settings UI always loads, glasses mode activates inside Even App WebView
- UTF-8 BOM stripping for 511.org protobuf responses
- 36 unit tests (Vitest): display rendering, feed extraction, cache, rate limiter, station search
