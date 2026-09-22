import type { NextResponse } from 'next/server'

export const GUEST_CLAIM_COOKIE = 'gm_studio_guest_claim'

const MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export function guestClaimCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

export function setGuestClaimCookie(response: NextResponse, claimToken: string): void {
  response.cookies.set(GUEST_CLAIM_COOKIE, claimToken, guestClaimCookieOptions())
}

export function clearGuestClaimCookie(response: NextResponse): void {
  response.cookies.set(GUEST_CLAIM_COOKIE, '', {
    ...guestClaimCookieOptions(),
    maxAge: 0,
  })
}

export function readGuestClaimToken(input: {
  cookieHeader?: string | null
  searchParams?: URLSearchParams
}): string | null {
  const fromQuery = input.searchParams?.get('claim')
  if (fromQuery && fromQuery.trim()) return fromQuery.trim()

  const header = input.cookieHeader
  if (!header) return null
  const parts = header.split(';')
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=')
    if (name === GUEST_CLAIM_COOKIE) {
      const value = rest.join('=').trim()
      return value || null
    }
  }
  return null
}
