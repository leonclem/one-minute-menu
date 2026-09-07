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

export interface StudioPageSession {
  userId: string
  email: string | undefined
  isAdmin: boolean
  gate: StudioPageGate
  accessMode: AccessMode
  accessReason: StudioAccessReason
  creditBalance: number | null
  studioFirstRunDismissed: boolean
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

  if (error || !user) {
    redirect('/auth/signin')
  }

  const currentUser = await getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'
  const [profile, requireAdminApproval] = await Promise.all([
    userOperations.getProfile(user.id),
    getFeatureFlag('require_admin_approval'),
  ])
  const accessMode = resolveStudioAccessMode()
  const access = await resolveStudioAccess({ userId: user.id, isAdmin })
  const gate = decideStudioPageGate({
    accessGranted: access.granted,
    accessReason: access.reason,
    pendingAccountApproval: isAccountPendingApproval({
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
      gate,
      accessMode,
      accessReason: access.reason,
      creditBalance: null,
      studioFirstRunDismissed: false,
    }
  }

  const [{ data: studioPreference }, creditBalance] = await Promise.all([
    supabase.from('profiles').select('studio_first_run_dismissed').eq('id', user.id).maybeSingle(),
    getStudioCreditBalance(user.id),
  ])

  return {
    userId: user.id,
    email: user.email ?? undefined,
    isAdmin,
    gate,
    accessMode,
    accessReason: access.reason,
    creditBalance,
    studioFirstRunDismissed: studioPreference?.studio_first_run_dismissed === true,
  }
})
