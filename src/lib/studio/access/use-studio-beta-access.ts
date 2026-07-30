'use client'

import { useEffect, useState } from 'react'
import { resolveStudioAccessMode } from '@/lib/product-mode'

export type StudioBetaAccessState = {
  /** Whether the entitlement request has completed or was not needed. */
  known: boolean
  /** A granted entitlement decision from the own-access endpoint. */
  hasAccess: boolean
}

type StudioAccessResponse = {
  success?: boolean
  granted?: boolean
}

/**
 * Resolve the beta entitlement used by client-side Studio navigation.
 *
 * The initial state is deliberately fail-closed for non-admin beta users:
 * callers should render their synchronous `canAccessPhotoStudio(isAdmin)`
 * result until `known` becomes true. Non-beta users, admins, and signed-out
 * headers do not need the own-access request.
 */
export function useStudioBetaAccess(
  isAdmin = false,
  enabled = true,
): StudioBetaAccessState {
  const mode = resolveStudioAccessMode()
  const shouldFetch = enabled && mode === 'beta' && !isAdmin
  const [state, setState] = useState<StudioBetaAccessState>(() => ({
    known: !shouldFetch,
    hasAccess: false,
  }))

  useEffect(() => {
    if (!shouldFetch) {
      setState({ known: true, hasAccess: false })
      return
    }

    let active = true
    setState({ known: false, hasAccess: false })

    void fetch('/api/studio/access', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => null) as StudioAccessResponse | null
        if (!response.ok || !data?.success) {
          throw new Error('Studio access lookup failed')
        }
        return data
      })
      .then((data) => {
        if (active) {
          setState({ known: true, hasAccess: data.granted === true })
        }
      })
      .catch(() => {
        // A failed lookup must not flash or retain an entitlement-aware grant.
        if (active) {
          setState({ known: true, hasAccess: false })
        }
      })

    return () => {
      active = false
    }
  }, [shouldFetch])

  return state
}
