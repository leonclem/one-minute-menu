/**
 * Middleware tests for CSRF and rate limiting.
 * We simulate NextRequest/NextResponse using minimal shims.
 */

// Mock Next.js server APIs before importing middleware
jest.mock('next/server', () => {
  const nextResponseMock = {
    next: jest.fn(() => ({ status: undefined, headers: new Map<string, string>() })),
    json: jest.fn((data: any, init?: any) => ({
      status: init?.status || 200,
      headers: new Map<string, string>(),
      json: async () => data,
    })),
    redirect: jest.fn((url: URL, status?: number) => ({
      status: status || 308,
      headers: new Map<string, string>(),
      url: url.toString(),
    })),
  }

  return {
    NextResponse: nextResponseMock,
  }
})

import { middleware } from '@/middleware'

function makeReq(url: string, init?: { method?: string; headers?: Record<string, string>; ip?: string }) {
  const headers = new Headers(init?.headers || {})
  const request = {
    method: init?.method || 'GET',
    headers,
    url,
    nextUrl: new URL(url),
  } as any
  ;(request as any).ip = init?.ip
  return request
}

function runMiddleware(url: string, init?: { method?: string; headers?: Record<string, string>; ip?: string }) {
  const req = makeReq(url, init)
  return middleware(req as any)
}

describe('middleware CSRF checks', () => {
  const apiUrl = 'https://example.com/api/menus'

  test('allows same-origin POST with Origin header', () => {
    const res = runMiddleware(apiUrl, {
      method: 'POST',
      headers: { origin: 'https://example.com' },
    })
    // NextResponse.next() returns a Response-like object without status (undefined)
    expect((res as any).status).toBeUndefined()
  })

  test('blocks cross-origin POST without matching referer', () => {
    const res = runMiddleware(apiUrl, {
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    }) as Response
    expect(res.status).toBe(403)
  })
})

describe('middleware rate limiting', () => {
  const extractionUrl = 'https://example.com/api/extraction/submit'

  test('allows under the limit and blocks after exceeding', () => {
    // Do 10 requests from the same IP within window
    for (let i = 0; i < 10; i++) {
      const res = runMiddleware(extractionUrl, { method: 'POST', headers: { origin: 'https://example.com' }, ip: '1.2.3.4' }) as any
      expect(res.status).toBeUndefined()
    }
    // 11th should be blocked (limit is 10/hour)
    const blocked = runMiddleware(extractionUrl, { method: 'POST', headers: { origin: 'https://example.com' }, ip: '1.2.3.4' }) as Response
    expect(blocked.status).toBe(429)
  })
})


