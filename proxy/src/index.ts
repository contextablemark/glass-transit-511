/**
 * Glass Transit Proxy — Cloudflare Worker
 *
 * Purpose-built proxy for 511.org transit API.
 * Handles CORS (511.org sends none) and keeps the API key server-side.
 *
 * Two modes:
 *   GET  /transit/tripupdates?agency=BA    → uses baked-in key (CDN-cacheable)
 *   POST /transit/tripupdates {agency,apiKey} → uses caller's key (BYOK)
 */

interface Env {
  API_511_KEY?: string
}

const ALLOWED_PATHS = ['/transit/tripupdates', '/transit/gtfsoperators']

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url = new URL(request.url)

    if (!ALLOWED_PATHS.includes(url.pathname)) {
      return new Response('Not found', { status: 404 })
    }

    let apiKey: string
    let agency = ''

    if (request.method === 'POST') {
      // BYOK: key in POST body
      const body = (await request.json()) as {
        apiKey?: string
        agency?: string
      }
      apiKey = body.apiKey || ''
      agency = body.agency || ''
    } else {
      // Community: baked-in key from Worker secret
      apiKey = env.API_511_KEY || ''
      agency = url.searchParams.get('agency') || ''
    }

    if (!apiKey) {
      return corsJson({ error: 'No API key configured' }, 401)
    }

    // Build upstream 511.org URL
    const upstream = new URL(`http://api.511.org${url.pathname}`)
    upstream.searchParams.set('api_key', apiKey)
    if (agency) upstream.searchParams.set('agency', agency)

    try {
      const resp = await fetch(upstream.toString())
      const body = await resp.arrayBuffer()

      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type':
            resp.headers.get('Content-Type') || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control':
            request.method === 'GET' ? 'public, max-age=30' : 'no-store',
        },
      })
    } catch (err) {
      return corsJson(
        {
          error: 'Upstream error',
          message: err instanceof Error ? err.message : String(err),
        },
        502
      )
    }
  },
}

function corsJson(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
