import { NextRequest, NextResponse } from 'next/server'

// In-memory simple rate limiter per IP + route. Works adequately on single region/instance.
// For serverless/edge it is best-effort and resets on cold starts, which is acceptable for MVP.
type RateRecord = { timestamps: number[] }

// Use globalThis to persist across hot reloads in dev
const globalStore = globalThis as unknown as { __RATE_LIMIT_MAP__?: Map<string, RateRecord> }
const rateLimitMap: Map<string, RateRecord> = globalStore.__RATE_LIMIT_MAP__ || new Map()
globalStore.__RATE_LIMIT_MAP__ = rateLimitMap

// Configure path-specific limits
const RATE_LIMIT_RULES: Array<{
  matcher: RegExp
  windowMs: number
  max: number
}> = [
  // Authentication endpoints: stricter
  { matcher: /^\/api\/auth\//, windowMs: 60_000, max: 5 },
  // Extraction endpoints
  { matcher: /^\/api\/extraction\/submit$/, windowMs: 60 * 60_000, max: 10 },
]

function getClientIp(req: NextRequest): string {
  // NextRequest.ip is populated on Vercel/Node
  const direct = (req as any).ip as string | undefined
  if (direct) return direct
  const xff = req.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0]?.trim() || '0.0.0.0'
}

function isStateChanging(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
}

function isPathMatched(pathname: string, rule: { matcher: RegExp }): boolean {
  return rule.matcher.test(pathname)
}

function applyRateLimit(key: string, rule: { windowMs: number; max: number }): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key) || { timestamps: [] }
  // Drop old timestamps outside window
  record.timestamps = record.timestamps.filter(ts => now - ts < rule.windowMs)
  if (record.timestamps.length >= rule.max) {
    rateLimitMap.set(key, record)
    return false
  }
  record.timestamps.push(now)
  rateLimitMap.set(key, record)
  return true
}

function passesCsrfCheck(req: NextRequest): boolean {
  const method = req.method
  if (!isStateChanging(method)) return true

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const url = new URL(req.url)
  const selfOrigin = url.origin

  // Allow same-origin
  if (origin && origin === selfOrigin) return true

  // Fallback: allow same-host referer
  if (referer) {
    try {
      const refUrl = new URL(referer)
      if (refUrl.host === url.host) return true
    } catch {
      // ignore parse errors
    }
  }

  // Allow preflight
  if (method === 'OPTIONS') return true

  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = new URL(req.url)

  // CSRF protection for state-changing API requests
  if (pathname.startsWith('/api/') && isStateChanging(req.method)) {
    if (!passesCsrfCheck(req)) {
      // Suspicious usage logging
      // eslint-disable-next-line no-console
      console.warn('[security] CSRF check failed', {
        path: pathname,
        method: req.method,
        origin: req.headers.get('origin') || null,
        referer: req.headers.get('referer') || null,
      })
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }
  }

  // Apply simple IP-based rate limits for selected endpoints
  for (const rule of RATE_LIMIT_RULES) {
    if (isPathMatched(pathname, rule)) {
      const ip = getClientIp(req)
      const key = `${ip}:${rule.matcher.source}`
      if (!applyRateLimit(key, rule)) {
        // eslint-disable-next-line no-console
        console.warn('[security] Rate limit exceeded', { path: pathname, ip })
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}


