import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, userOperations } from '@/lib/database'
import OnboardingClient from './onboarding-client'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // If user has already completed onboarding, skip it and go to dashboard
  const profile = await userOperations.getProfile(user.id)
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

