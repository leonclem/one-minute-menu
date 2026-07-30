type AccessMode = 'admin-only' | 'beta' | 'open'

export type StudioAccessReason =
  | 'granted_admin'
  | 'granted_beta'
  | 'granted_open'
  | 'denied_studio_disabled'
  | 'denied_admin_only'
  | 'denied_beta_access_required'

export type StudioAccessDecision = {
  granted: boolean
  reason: StudioAccessReason
}

export function decideStudioAccess(input: {
  mode: AccessMode
  studioEnabled: boolean
  isAdmin: boolean
  hasBetaAccess?: boolean
}): StudioAccessDecision {
  const { mode, studioEnabled, isAdmin } = input
  const hasBetaAccess = input.hasBetaAccess ?? false

  // The feature flag must dominate every other access condition.
  if (!studioEnabled) {
    return { granted: false, reason: 'denied_studio_disabled' }
  }

  // Admins are granted access in every mode once Studio is enabled.
  if (isAdmin) {
    return { granted: true, reason: 'granted_admin' }
  }

  switch (mode) {
    case 'open':
      return { granted: true, reason: 'granted_open' }
    case 'beta':
      return hasBetaAccess
        ? { granted: true, reason: 'granted_beta' }
        : { granted: false, reason: 'denied_beta_access_required' }
    case 'admin-only':
    default:
      // Keep unknown runtime values fail-closed, even though AccessMode is typed.
      return { granted: false, reason: 'denied_admin_only' }
  }
}
