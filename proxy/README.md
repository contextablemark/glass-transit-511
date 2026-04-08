# Glass Transit 511 Proxy

Cloudflare Worker that proxies requests to the 511.org GTFS-RT transit API. Required for Muni data and as a BART fallback.

**Note:** BART data is fetched directly from the BART Legacy API (api.bart.gov) which supports CORS natively — no proxy needed. This proxy is only required for Muni (GTFS-RT via 511.org, which does not send CORS headers) and as a fallback if the BART Legacy API is unavailable.

## Setup

1. Get a free 511.org API key at https://511.org/open-data
2. Create a Cloudflare API token at https://dash.cloudflare.com/profile/api-tokens (use the "Edit Cloudflare Workers" template)
3. Install dependencies:
   ```
   cd proxy
   npm install
   ```
4. Set your Cloudflare token:
   ```
   export CLOUDFLARE_API_TOKEN=your-cloudflare-token
   ```
5. Deploy the Worker:
   ```
   npx wrangler deploy
   ```
6. Set the 511.org API key as a secret:
   ```
   npx wrangler secret put API_511_KEY
   ```

The deploy will print a URL like `https://glass-transit-511-proxy.YOUR_SUBDOMAIN.workers.dev`. Enter this in the app's Settings → Advanced → Transit Proxy URL.

## Usage

The proxy supports two modes:

### Community mode (GET, CDN-cacheable)
```
GET https://your-worker.workers.dev/transit/tripupdates?agency=SF
```
Uses the baked-in API key (Worker secret). Responses are cached at the edge for 30 seconds.

### BYOK mode (POST, bring your own key)
```
POST https://your-worker.workers.dev/transit/tripupdates
Content-Type: application/json
{"agency": "SF", "apiKey": "your-511-key-here"}
```
Uses the caller's API key. Not cached.

## Rate limits

511.org allows 60 requests per hour per API key by default. For community instances serving multiple users, contact transitdata@511.org to request an increase.

## When is this proxy needed?

| Data source | Proxy needed? | Why |
|-------------|--------------|-----|
| BART (api.bart.gov) | No | BART API sends CORS headers natively |
| Muni (511.org GTFS-RT) | **Yes** | 511.org does not send CORS headers |
| BART fallback (511.org GTFS-RT) | **Yes** | Same — 511.org, no CORS headers |

If you only use BART stations and have a BART API key, you don't need this proxy at all.
