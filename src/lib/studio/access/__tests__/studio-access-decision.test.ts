import {
  decideStudioAccess,
  type StudioAccessReason,
} from '@/lib/studio/access/studio-access-decision'

type AccessMode = 'admin-only' | 'beta' | 'open'

type DecisionCase = {
  mode: AccessMode
  studioEnabled: boolean
  isAdmin: boolean
  hasBetaAccess: boolean
  granted: boolean
  reason: StudioAccessReason
}

const decisionCases: DecisionCase[] = [
  // Feature flag disabled: denial dominates every mode, role, and grant.
  { mode: 'admin-only', studioEnabled: false, isAdmin: false, hasBetaAccess: false, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'admin-only', studioEnabled: false, isAdmin: false, hasBetaAccess: true, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'admin-only', studioEnabled: false, isAdmin: true, hasBetaAccess: false, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'admin-only', studioEnabled: false, isAdmin: true, hasBetaAccess: true, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'beta', studioEnabled: false, isAdmin: false, hasBetaAccess: false, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'beta', studioEnabled: false, isAdmin: false, hasBetaAccess: true, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'beta', studioEnabled: false, isAdmin: true, hasBetaAccess: false, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'beta', studioEnabled: false, isAdmin: true, hasBetaAccess: true, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'open', studioEnabled: false, isAdmin: false, hasBetaAccess: false, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'open', studioEnabled: false, isAdmin: false, hasBetaAccess: true, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'open', studioEnabled: false, isAdmin: true, hasBetaAccess: false, granted: false, reason: 'denied_studio_disabled' },
  { mode: 'open', studioEnabled: false, isAdmin: true, hasBetaAccess: true, granted: false, reason: 'denied_studio_disabled' },

  // Feature flag enabled: admins are granted access in every mode.
  { mode: 'admin-only', studioEnabled: true, isAdmin: true, hasBetaAccess: false, granted: true, reason: 'granted_admin' },
  { mode: 'admin-only', studioEnabled: true, isAdmin: true, hasBetaAccess: true, granted: true, reason: 'granted_admin' },
  { mode: 'beta', studioEnabled: true, isAdmin: true, hasBetaAccess: false, granted: true, reason: 'granted_admin' },
  { mode: 'beta', studioEnabled: true, isAdmin: true, hasBetaAccess: true, granted: true, reason: 'granted_admin' },
  { mode: 'open', studioEnabled: true, isAdmin: true, hasBetaAccess: false, granted: true, reason: 'granted_admin' },
  { mode: 'open', studioEnabled: true, isAdmin: true, hasBetaAccess: true, granted: true, reason: 'granted_admin' },

  // Feature flag enabled: non-admin outcomes depend on the selected mode/grant.
  { mode: 'admin-only', studioEnabled: true, isAdmin: false, hasBetaAccess: false, granted: false, reason: 'denied_admin_only' },
  { mode: 'admin-only', studioEnabled: true, isAdmin: false, hasBetaAccess: true, granted: false, reason: 'denied_admin_only' },
  { mode: 'beta', studioEnabled: true, isAdmin: false, hasBetaAccess: false, granted: false, reason: 'denied_beta_access_required' },
  { mode: 'beta', studioEnabled: true, isAdmin: false, hasBetaAccess: true, granted: true, reason: 'granted_beta' },
  { mode: 'open', studioEnabled: true, isAdmin: false, hasBetaAccess: false, granted: true, reason: 'granted_open' },
  { mode: 'open', studioEnabled: true, isAdmin: false, hasBetaAccess: true, granted: true, reason: 'granted_open' },
]

describe('decideStudioAccess', () => {
  /** Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7, 10.2 */
  it.each(decisionCases)(
    'returns $granted/$reason for mode=$mode, studioEnabled=$studioEnabled, isAdmin=$isAdmin, hasBetaAccess=$hasBetaAccess',
    ({ mode, studioEnabled, isAdmin, hasBetaAccess, granted, reason }) => {
      expect(
        decideStudioAccess({ mode, studioEnabled, isAdmin, hasBetaAccess }),
      ).toEqual({ granted, reason })
    },
  )

  it('defaults omitted beta access to false for a non-admin in beta mode', () => {
    expect(
      decideStudioAccess({
        mode: 'beta',
        studioEnabled: true,
        isAdmin: false,
      }),
    ).toEqual({ granted: false, reason: 'denied_beta_access_required' })
  })
})
