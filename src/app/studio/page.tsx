export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth-utils'
import { UXHeader, UXFooter } from '@/components/ux'
import { StudioClient } from './_components/studio-client'
import { ensureDefaultStudioDish, listStudioDishes } from '@/lib/studio/dishes'
import { listStudioImagesForDish } from '@/lib/studio/library'
import { getStudioCreditBalance } from '@/lib/studio/credits'
import { resolveStudioAccess } from '@/lib/studio/access/studio-access'
import { resolveStudioAccessMode } from '@/lib/studio/access/studio-access-mode'
import { StudioStateNotice } from './_components/studio-state-notice'
import { StudioAccessDeniedTracker } from './_components/studio-access-denied-tracker'
import type { StudioDishRecord } from '@/lib/studio/types'

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
}: {
  children: ReactNode
  userEmail?: string
  isAdmin: boolean
}) {
  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      <div aria-hidden className="absolute inset-0 -z-10" style={studioBackdropStyle} />
      <div className="shrink-0" style={studioBrandBarStyle}>
        <UXHeader userEmail={userEmail} isAdmin={isAdmin} />
      </div>
      <main className="container-ux py-10 md:py-12 flex-1">{children}</main>
      <UXFooter />
    </div>
  )
}

export default async function StudioPage() {
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
  const accessMode = resolveStudioAccessMode()
  const access = await resolveStudioAccess({ userId: user.id, isAdmin })

  if (access.reason === 'denied_studio_disabled') {
    return (
      <StudioShell userEmail={user.email ?? undefined} isAdmin={false}>
        <StudioAccessDeniedTracker
          accessMode={accessMode}
          accessReason={access.reason}
          isAdmin={isAdmin}
          gallerySize={0}
        />
        <StudioStateNotice kind="disabled" />
      </StudioShell>
    )
  }

  if (access.reason === 'denied_beta_access_required') {
    return (
      <StudioShell userEmail={user.email ?? undefined} isAdmin={false}>
        <StudioAccessDeniedTracker
          accessMode={accessMode}
          accessReason={access.reason}
          isAdmin={isAdmin}
          gallerySize={0}
        />
        <StudioStateNotice kind="pending_access" />
      </StudioShell>
    )
  }

  if (access.reason === 'denied_admin_only') {
    notFound()
  }

  const { data: studioPreference } = await supabase
    .from('profiles')
    .select('studio_first_run_dismissed')
    .eq('id', user.id)
    .maybeSingle()

  let dishes: StudioDishRecord[] = await listStudioDishes(user.id)
  if (dishes.length === 0) {
    dishes = [await ensureDefaultStudioDish(user.id)]
  }

  const activeDishId = dishes[0].id
  const [initialGallery, creditBalance] = await Promise.all([
    listStudioImagesForDish(user.id, activeDishId),
    getStudioCreditBalance(user.id),
  ])

  return (
    <StudioShell userEmail={user.email ?? undefined} isAdmin={isAdmin}>
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
