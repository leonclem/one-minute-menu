import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ClientFlowShell from './ClientFlowShell'
import { UXAnalyticsProvider } from '@/components/ux'
import { userOperations } from '@/lib/database'
import { isOnboardingComplete, getOnboardingBlockReason } from '@/lib/onboarding-gate'
import { analyticsOperations } from '@/lib/analytics-server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Menu Processing | GridMenu',
  description: 'Upload and process your restaurant menu.',
}

export default async function MenuUxLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { menuId: string }
}) {
  const isDemoMenu = params.menuId.startsWith('demo-')
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Demo flow must be accessible without an account.
  if (!user && !isDemoMenu) {
    redirect('/auth/signin')
  }

  // Onboarding gate: block if approved but not complete (skip for demo routes)
  if (user && !isDemoMenu) {
    const profile = await userOperations.getProfile(user.id)

    const isAdmin = profile?.role === 'admin'
    const isApproved = profile?.isApproved || isAdmin

    if (isApproved && !isAdmin && !isOnboardingComplete(profile)) {
      const headerList = headers()
      const pathname = headerList.get('x-pathname') || `/menus/${params.menuId}`
      const reason = getOnboardingBlockReason(profile)

      console.warn('[onboarding] gate_blocked_navigation', {
        userId: user.id,
        email: user.email,
        path: pathname,
        reason
      })

      try {
        await analyticsOperations.trackPlatformMetric('onboarding_gate_blocked', 1, {
          userId: user.id,
          path: pathname,
          reason,
          layer: 'navigation'
        })
      } catch (err) {}

      redirect(`/onboarding?reason=required&next=${encodeURIComponent(pathname)}`)
    }
  }

  return (
    <div className="ux-implementation min-h-dvh md:min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image fixed to viewport so tall content scrolls over without stretching */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%'
        }}
      />
      <UXHeader userEmail={user?.email ?? undefined} />
      <UXAnalyticsProvider>
        <main className="flex-1">
          <ClientFlowShell menuId={params.menuId}>
            {children}
          </ClientFlowShell>
        </main>
      </UXAnalyticsProvider>
      <UXFooter />
    </div>
  )
}
