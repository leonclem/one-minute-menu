export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth-utils'
import { userOperations } from '@/lib/database'
import { getFeatureFlag } from '@/lib/feature-flags'
import { isPhotoStudioEnabled } from '@/lib/product-mode'
import { UXHeader, UXFooter } from '@/components/ux'
import { PendingApproval } from '@/components/dashboard/PendingApproval'
import { StudioClient } from './_components/studio-client'
import type { StudioImageRecord } from '@/lib/studio/types'

export default async function StudioPage() {
  if (!isPhotoStudioEnabled()) {
    notFound()
  }

  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  const [profile, currentUser, galleryResult] = await Promise.all([
    userOperations.getProfile(user.id),
    getCurrentUser(),
    supabase
      .from('studio_images')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  const isAdmin = currentUser?.role === 'admin'
  const requireAdminApproval = await getFeatureFlag('require_admin_approval')

  if (requireAdminApproval && !isAdmin && profile && !profile.isApproved) {
    return (
      <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center 30%',
          }}
        />
        <UXHeader userEmail={user.email ?? undefined} isAdmin={false} />
        <main className="container-ux py-10 md:py-12 flex-1">
          <PendingApproval email={user.email} />
        </main>
        <UXFooter />
      </div>
    )
  }

  const initialGallery = (galleryResult.data ?? []) as StudioImageRecord[]

  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%',
        }}
      />
      <UXHeader userEmail={user.email ?? undefined} isAdmin={isAdmin} />
      <main className="container-ux py-10 md:py-12 flex-1">
        <StudioClient initialGallery={initialGallery} />
      </main>
      <UXFooter />
    </div>
  )
}
