import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/onboarding'

  // If we have a preferred site URL configured and we're currently on the Vercel domain
  // (or any other domain that isn't the primary one), redirect to the primary domain
  // while keeping the code and other params. This ensures the session is established
  // on the correct domain (e.g., gridmenu.ai instead of one-minute-menu.vercel.app).
  const preferredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (preferredSiteUrl && process.env.NODE_ENV === 'production') {
    try {
      const preferredOrigin = new URL(preferredSiteUrl).origin
      if (url.origin !== preferredOrigin) {
        console.log(`[auth] Domain mismatch detected. Redirecting from ${url.origin} to ${preferredOrigin}`)
        const redirectUrl = new URL(url.pathname + url.search, preferredOrigin)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (e) {
      console.error('[auth] Invalid NEXT_PUBLIC_SITE_URL:', preferredSiteUrl)
    }
  }

  const res = NextResponse.redirect(new URL(next, url.origin))

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value
      },
      set(name, value, options) {
        res.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        res.cookies.set({ name, value: '', ...options })
      },
    },
  })

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  return res
}


