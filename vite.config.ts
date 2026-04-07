import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/**
 * Vite plugin: transit proxy for local development.
 *
 * Routes /transit/* requests to api.511.org, injecting the API key
 * from .env (server-side only — NOT prefixed with VITE_).
 *
 * Supports both modes:
 *   GET  /transit/tripupdates?agency=BA    → uses .env key (community mode)
 *   POST /transit/tripupdates {agency,apiKey} → uses body key (BYOK mode)
 */
function transitProxy(): Plugin {
  let apiKey = ''

  return {
    name: 'transit-proxy',
    configResolved(config) {
      // Load .env without VITE_ prefix requirement
      const env = loadEnv(config.mode, config.root, '')
      apiKey = env.API_511_KEY || ''
      if (apiKey) {
        console.log('[transit-proxy] API key loaded from .env')
      } else {
        console.warn('[transit-proxy] WARNING: No API_511_KEY in .env — proxy will reject requests')
      }
    },
    configureServer(server) {
      // Single handler for all /transit/* requests (including OPTIONS)
      server.middlewares.use('/transit', async (req, res) => {
        // CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          res.end()
          return
        }

        let key = apiKey
        let agency = ''

        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString())
          key = body.apiKey || key
          agency = body.agency || ''
        } else {
          const parsed = new URL(req.url || '', 'http://localhost')
          agency = parsed.searchParams.get('agency') || ''
        }

        if (!key) {
          console.error('[transit-proxy] No API key — set API_511_KEY in .env')
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No API key. Set API_511_KEY in .env' }))
          return
        }

        // Extract the sub-path (e.g. /tripupdates from /transit/tripupdates)
        const subPath = (req.url || '').split('?')[0]
        const upstream = new URL(`http://api.511.org/transit${subPath}`)
        upstream.searchParams.set('api_key', key)
        if (agency) upstream.searchParams.set('agency', agency)

        console.log(`[transit-proxy] ${req.method} → ${upstream.pathname}?agency=${agency}`)

        try {
          const resp = await fetch(upstream.toString())
          const buffer = await resp.arrayBuffer()
          console.log(`[transit-proxy] ← ${resp.status} (${buffer.byteLength} bytes)`)
          res.writeHead(resp.status, {
            'Content-Type':
              resp.headers.get('content-type') || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(Buffer.from(buffer))
        } catch (err) {
          console.error('[transit-proxy] Upstream error:', err)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: 'Proxy error',
              message: err instanceof Error ? err.message : String(err),
            })
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), transitProxy()],
  server: {
    host: true,
    port: 5174,
  },
})
