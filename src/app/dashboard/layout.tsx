import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'
import { isOnboardingComplete, getOnboardingBlockReason } from '@/lib/onboarding-gate'
import { analyticsOperations } from '@/lib/analytics-server'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const profile = await userOperations.getProfile(user.id)
  
  // If not approved, we let the individual pages handle the PendingApproval UI
  // (matching existing patterns in dashboard/page.tsx)
  const isAdmin = profile?.role === 'admin'
  const isApproved = profile?.isApproved || isAdmin

  if (isApproved && !isAdmin && !isOnboardingComplete(profile)) {
    const headerList = headers()
    const pathname = headerList.get('x-pathname') || '/dashboard'
    const reason = getOnboardingBlockReason(profile)
    
    console.warn('[onboarding] gate_blocked_navigation', {
      userId: user.id,
      email: user.email,
      path: pathname,
      reason
    })

    // Track platform metric
    try {
      await analyticsOperations.trackPlatformMetric('onboarding_gate_blocked', 1, {
        userId: user.id,
        path: pathname,
        reason,
        layer: 'navigation'
      })
    } catch (err) {
      // Non-fatal
    }

    redirect(`/onboarding?reason=required&next=${encodeURIComponent(pathname)}`)
  }

  return <>{children}</>
}
