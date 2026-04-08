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

/**
 * Vite plugin: BART API logging proxy for dev mode.
 *
 * Routes /bart-api/* to api.bart.gov so requests appear in the terminal.
 * The client fetches /bart-api/... instead of api.bart.gov directly in dev mode.
 */
function bartProxy(): Plugin {
  return {
    name: 'bart-proxy',
    configureServer(server) {
      server.middlewares.use('/bart-api', async (req, res) => {
        const upstream = `https://api.bart.gov/api${req.url}`

        console.log(`[bart-api] GET → ${req.url}`)

        try {
          const resp = await fetch(upstream)
          const text = await resp.text()

          // Parse to count arrivals for logging
          try {
            const data = JSON.parse(text)
            const etds = data?.root?.station?.[0]?.etd || []
            const total = etds.reduce(
              (n: number, e: any) => n + (e.estimate?.length || 0), 0
            )
            console.log(`[bart-api] ← ${resp.status} (${total} arrivals)`)
          } catch {
            console.log(`[bart-api] ← ${resp.status} (${text.length} bytes)`)
          }

          res.writeHead(resp.status, {
            'Content-Type': resp.headers.get('content-type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(text)
        } catch (err) {
          console.error('[bart-api] Upstream error:', err)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            error: 'Proxy error',
            message: err instanceof Error ? err.message : String(err),
          }))
        }
      })
    },
  }
}

/**
 * Vite plugin: client-side log relay for dev mode.
 * Client POSTs to /dev-log, server prints to terminal.
 */
function devLog(): Plugin {
  return {
    name: 'dev-log',
    configureServer(server) {
      server.middlewares.use('/dev-log', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const body = Buffer.concat(chunks).toString()
        try {
          const { msg } = JSON.parse(body)
          console.log(`[client] ${msg}`)
        } catch {
          console.log(`[client] ${body}`)
        }
        res.writeHead(200)
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), transitProxy(), bartProxy(), devLog()],
  server: {
    host: true,
    port: 5174,
  },
})
