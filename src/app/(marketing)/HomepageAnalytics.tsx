'use client'

/**
 * HomepageAnalytics — client sub-component that fires `homepage_viewed` on mount.
 *
 * The homepage route (`src/app/(marketing)/page.tsx`) is a server component, so
 * analytics side-effects must live in a dedicated `'use client'` component.
 *
 * Implements: 4.1
 */

import { useEffect } from 'react'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'

export default function HomepageAnalytics() {
  useEffect(() => {
    captureEvent(ANALYTICS_EVENTS.HOMEPAGE_VIEWED)
  }, [])

  return null
}
