'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import { trackStudioEvent } from '@/lib/studio/analytics/studio-analytics'

export function StudioGuestBootstrap() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const { error: authError } = await supabase.auth.signInAnonymously()
        if (authError) {
          throw new Error(authError.message)
        }

        const sessionRes = await fetch('/api/studio/guest/session', { method: 'POST' })
        if (!sessionRes.ok) {
          const payload = (await sessionRes.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error || 'Could not start a guest session.')
        }
        if (!cancelled) {
          trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GUEST_STARTED, { surface: 'studio' })
          router.refresh()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open Studio.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="mx-auto max-w-md py-16 text-center" data-testid="studio-guest-bootstrap">
      {error ? (
        <div>
          <p className="text-sm text-[#ff8a80]" role="alert">
            {error}
          </p>
          <p className="mt-3 text-sm text-white/55">
            Sign in to continue, or refresh to try again.
          </p>
          <a href="/auth/signin" className="studio-link mt-4 inline-block text-sm font-semibold">
            Sign in
          </a>
        </div>
      ) : (
        <p className="text-sm text-white/55" role="status">
          Opening Studio…
        </p>
      )}
    </div>
  )
}
