'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { consumeDashboardRefreshFlag } from '@/lib/dashboard-refresh'

/**
 * Forces a fresh server render of `/dashboard` after known mutations.
 *
 * This avoids cases where the Next.js client router navigates using a prefetched/cached
 * RSC payload, leaving the dashboard list stale until a manual refresh.
 */
export function DashboardAutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    if (consumeDashboardRefreshFlag()) {
      router.refresh()
    }
  }, [router])

  return null
}

