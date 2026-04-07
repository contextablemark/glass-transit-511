# Changelog

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
