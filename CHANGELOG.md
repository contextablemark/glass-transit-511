# Changelog

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
