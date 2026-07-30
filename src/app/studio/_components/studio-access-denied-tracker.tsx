'use client'

import { useEffect, useRef } from 'react'

import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import { trackStudioEvent } from '@/lib/studio/analytics/studio-analytics'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import type { AccessMode } from '@/lib/studio/access/studio-access-mode'

type DeniedStudioAccessReason = Extract<
  StudioAccessReason,
  'denied_studio_disabled' | 'denied_beta_access_required'
>

interface StudioAccessDeniedTrackerProps {
  accessMode: AccessMode
  accessReason: DeniedStudioAccessReason
  isAdmin: boolean
  gallerySize: number
}

/** Emits the denied-access event after the server-rendered state reaches the browser. */
export function StudioAccessDeniedTracker({
  accessMode,
  accessReason,
  isAdmin,
  gallerySize,
}: StudioAccessDeniedTrackerProps) {
  const didTrackRef = useRef(false)

  useEffect(() => {
    if (didTrackRef.current) return
    didTrackRef.current = true
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_ACCESS_DENIED, {
      surface: 'studio',
      access_mode: accessMode,
      access_reason: accessReason,
      is_admin: isAdmin,
      gallery_size: gallerySize,
    })
  }, [accessMode, accessReason, gallerySize, isAdmin])

  return null
}
