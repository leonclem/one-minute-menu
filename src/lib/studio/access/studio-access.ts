import { isPhotoStudioEnabled } from '@/lib/product-mode'
import { hasStudioBetaAccess } from './beta-access-store'
import { decideStudioAccess, type StudioAccessDecision } from './studio-access-decision'
import { resolveStudioAccessMode } from './studio-access-mode'

export async function resolveStudioAccess(input: {
  userId: string
  isAdmin: boolean
}): Promise<StudioAccessDecision> {
  const mode = resolveStudioAccessMode()
  const studioEnabled = isPhotoStudioEnabled()

  // Only beta-mode non-admin users need an entitlement lookup.
  const needsLookup = studioEnabled && mode === 'beta' && !input.isAdmin
  let hasBetaAccess = false

  if (needsLookup) {
    try {
      hasBetaAccess = await hasStudioBetaAccess(input.userId)
    } catch (error) {
      // Fail closed: a store failure must never widen access.
      console.error('[studio-access] beta access lookup failed', {
        userId: input.userId,
        error: error instanceof Error ? error.message : 'unknown',
      })
      hasBetaAccess = false
    }
  }

  return decideStudioAccess({
    mode,
    studioEnabled,
    isAdmin: input.isAdmin,
    hasBetaAccess,
  })
}
