import { cache } from 'react'
import { redirect } from 'next/navigation'

import { isAccountPendingApproval } from '@/lib/account-approval'
import { getCurrentUser } from '@/lib/auth-utils'
import { userOperations } from '@/lib/database'
import { getFeatureFlag } from '@/lib/feature-flags'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveStudioAccess } from '@/lib/studio/access/studio-access'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import { resolveStudioAccessMode, type AccessMode } from '@/lib/studio/access/studio-access-mode'
import { getStudioCreditBalance } from '@/lib/studio/credits'
import { decideStudioPageGate, type StudioPageGate } from '@/lib/studio/studio-page-gate'
import { isGuestAuthUser, resolveGuestStudioPathAllowed } from '@/lib/studio/guest/guest-path'

export interface StudioPageSession {
  userId: string
  email: string | undefined
  isAdmin: boolean
  isGuest: boolean
  gate: StudioPageGate
  accessMode: AccessMode
  accessReason: StudioAccessReason
  creditBalance: number | null
  studioFirstRunDismissed: boolean
}

function guestBootstrapSession(accessMode: AccessMode): StudioPageSession {
  return {
    userId: '',
    email: undefined,
    isAdmin: false,
    isGuest: true,
    gate: 'guest_bootstrap',
    accessMode,
    accessReason: 'granted_open',
    creditBalance: null,
    studioFirstRunDismissed: false,
  }
}

/**
 * Auth + Studio gate for every /studio route. Deduped with React cache() so
 * layout and page share one load.
 */
export const loadStudioPageSession = cache(async (): Promise<StudioPageSession> => {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  const accessMode = resolveStudioAccessMode()
  const requireAdminApproval = await getFeatureFlag('require_admin_approval')
  const guestPathAllowed = resolveGuestStudioPathAllowed(requireAdminApproval)

  if (error || !user) {
    if (guestPathAllowed) return guestBootstrapSession(accessMode)
    redirect('/auth/signin')
  }

  const currentUser = await getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'
  const profile = await userOperations.getProfile(user.id)
  const { data: guestProfile } = await supabase
    .from('profiles')
    .select('is_guest, studio_first_run_dismissed')
    .eq('id', user.id)
    .maybeSingle()
  const isGuest = guestProfile?.is_guest === true || isGuestAuthUser(user)

  if (isGuest && !guestPathAllowed) {
    redirect('/auth/signin')
  }

  const access = await resolveStudioAccess({ userId: user.id, isAdmin })
  const gate = decideStudioPageGate({
    accessGranted: access.granted,
    accessReason: access.reason,
    pendingAccountApproval:
      !isGuest &&
      isAccountPendingApproval({
        requireAdminApproval,
        isAdmin,
        isApproved: profile?.isApproved,
      }),
  })

  if (gate !== 'editor') {
    return {
      userId: user.id,
      email: user.email ?? undefined,
      isAdmin,
      isGuest,
      gate,
      accessMode,
      accessReason: access.reason,
      creditBalance: null,
      studioFirstRunDismissed: false,
    }
  }

  const creditBalance = isGuest ? null : await getStudioCreditBalance(user.id)

  return {
    userId: user.id,
    email: isGuest ? undefined : user.email ?? undefined,
    isAdmin,
    isGuest,
    gate,
    accessMode,
    accessReason: access.reason,
    creditBalance,
    studioFirstRunDismissed: !isGuest && guestProfile?.studio_first_run_dismissed === true,
  }
})
