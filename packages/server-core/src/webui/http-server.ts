/**
 * Web UI HTTP server.
 *
 * Extends the existing health endpoint with:
 * - Static login page (no auth)
 * - POST /api/auth (verify password, set session cookie)
 * - POST /api/auth/logout (clear session cookie)
 * - SPA static file serving (requires valid session cookie)
 */

import { join, extname } from 'node:path'
import {
  RateLimiter,
  verifyPassword,
  createSessionToken,
  validateSession,
  buildSessionCookie,
  buildLogoutCookie,
} from './auth'
import type { PlatformServices } from '../runtime/platform'

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.map': 'application/json',
}

function getMimeType(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

function getForwardedValue(req: Request, key: 'proto' | 'host'): string | null {
  const forwarded = req.headers.get('forwarded')
  if (!forwarded) return null

  const match = forwarded.match(new RegExp(`${key}="?([^;,"]+)"?`, 'i'))
  return match?.[1]?.trim() || null
}

function getRequestProto(req: Request): string {
  return req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    || getForwardedValue(req, 'proto')
    || new URL(req.url).protocol.replace(/:$/, '')
}

function getRequestHost(req: Request): string | null {
  return req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    || getForwardedValue(req, 'host')
    || req.headers.get('host')
}

function formatHostWithPort(host: string, port: number): string {
  try {
    const parsed = new URL(`http://${host}`)
    const hostname = parsed.hostname.includes(':') ? `[${parsed.hostname}]` : parsed.hostname
    return `${hostname}:${port}`
  } catch {
    const withoutPort = host.replace(/:\d+$/, '')
    return `${withoutPort}:${port}`
  }
}

export function shouldUseSecureCookies(req: Request, secureCookies?: boolean): boolean {
  if (secureCookies != null) return secureCookies
  return getRequestProto(req) === 'https'
}

export interface ResolveWebSocketUrlOptions {
  publicWsUrl?: string
  wsProtocol: 'ws' | 'wss'
  wsPort: number
}

export function resolveWebSocketUrl(
  req: Request,
  { publicWsUrl, wsProtocol, wsPort }: ResolveWebSocketUrlOptions,
): string {
  if (publicWsUrl) return publicWsUrl

  const host = getRequestHost(req)
  if (host) {
    return `${wsProtocol}://${formatHostWithPort(host, wsPort)}`
  }

  return `${wsProtocol}://127.0.0.1:${wsPort}`
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WebuiHttpServerOptions {
  /** Port to bind on. Use 0 for an ephemeral port in tests. */
  port: number
  /** Path to built web UI dist/ directory. */
  webuiDir: string
  /** Secret used to sign JWTs — typically CRAFT_SERVER_TOKEN. */
  secret: string
  /** Optional separate web UI password. Falls back to `secret` for verification. */
  password?: string
  /** Explicit Secure-cookie override. When unset, infer from the request / proxy headers. */
  secureCookies?: boolean
  /** Optional browser-facing WebSocket URL override for reverse-proxy deployments. */
  publicWsUrl?: string
  /** RPC WebSocket protocol used when building a browser-facing fallback URL. */
  wsProtocol: 'ws' | 'wss'
  /** RPC WebSocket port used when building a browser-facing fallback URL. */
  wsPort: number
  /** Health check function (injected from existing server handler). */
  getHealthCheck: () => { status: string }
  /** Logger. */
  logger: PlatformServices['logger']
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export async function startWebuiHttpServer(
  options: WebuiHttpServerOptions,
): Promise<{ port: number, stop: () => void }> {
  const {
    port,
    webuiDir,
    secret,
    password,
    secureCookies,
    publicWsUrl,
    wsProtocol,
    wsPort,
    getHealthCheck,
    logger,
  } = options

  const rateLimiter = new RateLimiter(5, 60_000)
  const cleanupTimer = setInterval(() => rateLimiter.cleanup(), 120_000)

  // The password used for the login form — separate web password or the server token
  const loginPassword = password || secret

  const server = Bun.serve({
    port,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)
      const path = url.pathname
      const useSecureCookies = shouldUseSecureCookies(req, secureCookies)

      // ── Health endpoint (no auth) ──
      if (path === '/health') {
        const health = getHealthCheck()
        return Response.json(health, {
          status: health.status === 'ok' ? 200 : 503,
        })
      }

      // ── Login page (no auth) ──
      if (path === '/login' || path === '/login/') {
        const loginFile = Bun.file(join(webuiDir, 'login.html'))
        if (await loginFile.exists()) {
          return new Response(loginFile, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
        return new Response('Login page not found', { status: 404 })
      }

      // ── Static assets that login page needs (no auth) ──
      // Allow favicon and any /login-assets/ path without auth
      if (path === '/favicon.ico' || path.startsWith('/login-assets/')) {
        const file = Bun.file(join(webuiDir, path))
        if (await file.exists()) {
          return new Response(file, {
            headers: { 'Content-Type': getMimeType(path) },
          })
        }
        return new Response('Not Found', { status: 404 })
      }

      // ── Auth endpoint ──
      if (path === '/api/auth' && req.method === 'POST') {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? req.headers.get('x-real-ip')
          ?? 'unknown'

        if (!rateLimiter.check(ip)) {
          logger.warn(`[webui] Rate limited auth attempt from ${ip}`)
          return Response.json(
            { error: 'Too many attempts. Try again later.' },
            { status: 429 },
          )
        }

        let body: { password?: string }
        try {
          body = await req.json() as { password?: string }
        } catch {
          return Response.json({ error: 'Invalid request body' }, { status: 400 })
        }

        if (!body.password || typeof body.password !== 'string') {
          return Response.json({ error: 'Password is required' }, { status: 400 })
        }

        if (!verifyPassword(body.password, loginPassword)) {
          logger.warn(`[webui] Failed auth attempt from ${ip}`)
          return Response.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        const jwt = await createSessionToken(secret)
        logger.info(`[webui] Successful auth from ${ip}`)

        return Response.json({ ok: true }, {
          status: 200,
          headers: {
            'Set-Cookie': buildSessionCookie(jwt, useSecureCookies),
          },
        })
      }

      // ── Logout endpoint ──
      if (path === '/api/auth/logout' && req.method === 'POST') {
        return new Response(null, {
          status: 204,
          headers: {
            'Set-Cookie': buildLogoutCookie(useSecureCookies),
          },
        })
      }

      // ── Config endpoint (requires session cookie) ──
      // Returns WS URL and other client configuration
      if (path === '/api/config' && req.method === 'GET') {
        const configSession = await validateSession(req.headers.get('cookie'), secret)
        if (!configSession) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return Response.json({
          wsUrl: resolveWebSocketUrl(req, { publicWsUrl, wsProtocol, wsPort }),
        })
      }

      // ── Everything below requires a valid session cookie ──
      const cookieHeader = req.headers.get('cookie')
      const session = await validateSession(cookieHeader, secret)

      if (!session) {
        // For HTML requests (browser navigation), redirect to login
        const accept = req.headers.get('accept') ?? ''
        if (accept.includes('text/html') || path === '/' || path === '') {
          return Response.redirect('/login', 302)
        }
        // For API/asset requests, return 401
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // ── Serve SPA static files ──
      // Try exact file match first
      if (path !== '/') {
        const file = Bun.file(join(webuiDir, path))
        if (await file.exists()) {
          return new Response(file, {
            headers: { 'Content-Type': getMimeType(path) },
          })
        }
      }

      // SPA fallback — serve index.html for all non-file routes
      const indexFile = Bun.file(join(webuiDir, 'index.html'))
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  const boundPort = server.port ?? port

  logger.info(`[webui] Web UI server listening on http://0.0.0.0:${boundPort}`)

  return {
    port: boundPort,
    stop: () => {
      clearInterval(cleanupTimer)
      server.stop()
    },
  }
}
