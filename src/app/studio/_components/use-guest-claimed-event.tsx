'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import { trackStudioEvent } from '@/lib/studio/analytics/studio-analytics'

export function useGuestClaimedEvent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    if (searchParams.get('guest_claimed') !== '1') return
    tracked.current = true
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GUEST_CLAIMED, { outcome: 'success' })
    const next = new URLSearchParams(searchParams.toString())
    next.delete('guest_claimed')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])
}
