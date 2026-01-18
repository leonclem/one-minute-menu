import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, userOperations } from '@/lib/database'
import OnboardingClient from './onboarding-client'
import { PendingApproval } from '@/components/dashboard/PendingApproval'
import { UXHeader, UXFooter } from '@/components/ux'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // If user has already completed onboarding, skip it and go to dashboard
  const profile = await userOperations.getProfile(user.id)
  
  // APPROVAL GATE
  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && profile && !profile.isApproved) {
    return (
      <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center 30%'
          }}
        />
        <UXHeader userEmail={user.email ?? undefined} isAdmin={false} />
        <main className="container-ux py-10 md:py-12">
          <PendingApproval email={user.email} />
        </main>
        <UXFooter />
      </div>
    )
  }

  if (profile?.onboardingCompleted) {
    redirect('/dashboard')
  }

  // Fallback: If user already has menus, they shouldn't see onboarding
  const menus = await menuOperations.getUserMenus(user.id)
  if (menus && menus.length > 0) {
    redirect('/dashboard')
  }

  return <OnboardingClient userEmail={user.email} />
}

