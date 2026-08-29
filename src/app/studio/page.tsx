export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth-utils'
import { userOperations } from '@/lib/database'
import { getFeatureFlag } from '@/lib/feature-flags'
import { isAccountPendingApproval } from '@/lib/account-approval'
import { UXHeader, UXFooter } from '@/components/ux'
import { PendingApproval } from '@/components/dashboard/PendingApproval'
import { SignupConversionBeacon } from '@/components/analytics/SignupConversionBeacon'
import { StudioClient } from './_components/studio-client'
import { listStudioDishes } from '@/lib/studio/dishes'
import { listStudioImagesForDish } from '@/lib/studio/library'
import { getStudioCreditBalance } from '@/lib/studio/credits'
import { resolveStudioAccess } from '@/lib/studio/access/studio-access'
import { resolveStudioAccessMode } from '@/lib/studio/access/studio-access-mode'
import { decideStudioPageGate } from '@/lib/studio/studio-page-gate'
import { StudioStateNotice } from './_components/studio-state-notice'
import { StudioAccessDeniedTracker } from './_components/studio-access-denied-tracker'
import type { StudioDishRecord } from '@/lib/studio/types'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'

/** Light studio backdrop — cream + soft gold + brand teal, no photo. */
const studioBackdropStyle = {
  backgroundImage: [
    'radial-gradient(ellipse 90% 55% at 5% 0%, rgba(200, 165, 98, 0.22), transparent 55%)',
    'radial-gradient(ellipse 80% 60% at 100% 95%, rgba(1, 179, 191, 0.22), transparent 58%)',
    'linear-gradient(165deg, #ebe4d8 0%, #dde8ea 50%, #cfe4e7 100%)',
  ].join(', '),
} as const

const studioBrandBarStyle = {
  backgroundColor: 'rgb(var(--ux-primary))',
} as const

function StudioShell({
  children,
  userEmail,
  isAdmin,
  isNewSignup = false,
}: {
  children: ReactNode
  userEmail?: string
  isAdmin: boolean
  isNewSignup?: boolean
}) {
  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      <SignupConversionBeacon enabled={isNewSignup} />
      <div aria-hidden className="absolute inset-0 -z-10" style={studioBackdropStyle} />
      <div className="shrink-0" style={studioBrandBarStyle}>
        <UXHeader userEmail={userEmail} isAdmin={isAdmin} />
      </div>
      <main className="container-ux w-full py-10 md:py-12 flex-1">{children}</main>
      <UXFooter />
    </div>
  )
}

function PendingInviteNotice({
  accessMode,
  accessReason,
  isAdmin,
}: {
  accessMode: ReturnType<typeof resolveStudioAccessMode>
  accessReason: Extract<StudioAccessReason, 'denied_admin_only' | 'denied_beta_access_required'>
  isAdmin: boolean
}) {
  return (
    <>
      <StudioAccessDeniedTracker
        accessMode={accessMode}
        accessReason={accessReason}
        isAdmin={isAdmin}
        gallerySize={0}
      />
      <StudioStateNotice kind="pending_access" />
    </>
  )
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: { new_signup?: string }
}) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  const isNewSignup = searchParams.new_signup === 'true'
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

  if (gate === 'waitlist') {
    return (
      <StudioShell userEmail={user.email ?? undefined} isAdmin={false} isNewSignup={isNewSignup}>
        <PendingApproval email={user.email} />
      </StudioShell>
    )
  }

  if (gate === 'disabled') {
    return (
      <StudioShell userEmail={user.email ?? undefined} isAdmin={false} isNewSignup={isNewSignup}>
        <StudioAccessDeniedTracker
          accessMode={accessMode}
          accessReason="denied_studio_disabled"
          isAdmin={isAdmin}
          gallerySize={0}
        />
        <StudioStateNotice kind="disabled" />
      </StudioShell>
    )
  }

  if (gate === 'pending_invite') {
    const inviteReason =
      access.reason === 'denied_beta_access_required'
        ? 'denied_beta_access_required'
        : 'denied_admin_only'
    return (
      <StudioShell userEmail={user.email ?? undefined} isAdmin={false} isNewSignup={isNewSignup}>
        <PendingInviteNotice
          accessMode={accessMode}
          accessReason={inviteReason}
          isAdmin={isAdmin}
        />
      </StudioShell>
    )
  }

  const { data: studioPreference } = await supabase
    .from('profiles')
    .select('studio_first_run_dismissed')
    .eq('id', user.id)
    .maybeSingle()

  const dishes: StudioDishRecord[] = await listStudioDishes(user.id)
  const activeDishId = dishes[0]?.id ?? ''
  const [initialGallery, creditBalance] = await Promise.all([
    activeDishId ? listStudioImagesForDish(user.id, activeDishId) : Promise.resolve([]),
    getStudioCreditBalance(user.id),
  ])
  return (
    <StudioShell userEmail={user.email ?? undefined} isAdmin={isAdmin} isNewSignup={isNewSignup}>
      <StudioClient
        reason={access.reason}
        accessMode={accessMode}
        creditBalance={creditBalance}
        dishes={dishes}
        gallery={initialGallery}
        initialActiveDishId={activeDishId}
        studioFirstRunDismissed={studioPreference?.studio_first_run_dismissed === true}
        isAdmin={isAdmin}
      />
    </StudioShell>
  )
}
