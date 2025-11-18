'use client'

import { useEffect } from 'react'
import { initWebVitalsTracking } from '@/lib/conversion-tracking'

interface UXAnalyticsProviderProps {
  children: React.ReactNode
}

/**
 * Wraps UX routes with lightweight client-side analytics concerns,
 * such as Core Web Vitals sampling. Kept intentionally minimal so
 * it can be reused across all UX pages without coupling to any
 * particular step.
 */
export function UXAnalyticsProvider({ children }: UXAnalyticsProviderProps) {
  useEffect(() => {
    initWebVitalsTracking()
  }, [])

  return <>{children}</>
}


