# Glass Transit 511 Proxy

Cloudflare Worker that proxies requests to the 511.org transit API. Handles CORS and keeps the API key server-side.

## Setup

1. Get a free API key at https://511.org/open-data
2. Install Wrangler: `npm install -g wrangler`
3. Authenticate: `wrangler login`
4. Set your API key as a secret:
   ```
   wrangler secret put API_511_KEY
   ```
5. Deploy:
   ```
   wrangler deploy
   ```

## Usage

The proxy supports two modes:

### Community mode (GET, CDN-cacheable)
```
GET https://your-worker.workers.dev/transit/tripupdates?agency=BA
```
Uses the baked-in API key. Responses are cached at the edge for 30 seconds.

### BYOK mode (POST, bring your own key)
```
POST https://your-worker.workers.dev/transit/tripupdates
Content-Type: application/json
{"agency": "BA", "apiKey": "your-key-here"}
```
Uses the caller's API key. Not cached.

## Rate limits

511.org allows 60 requests per hour per API key by default. For community instances serving multiple users, contact transitdata@511.org to request an increase.
