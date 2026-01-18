export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations, menuOperations } from '@/lib/database'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { getCurrentUser } from '@/lib/auth-utils'
import { UXHeader, UXFooter, UXCard, UXButton } from '@/components/ux'
import { MenuCard } from '@/components/dashboard'
import { DashboardAutoRefresh } from '@/components/dashboard/DashboardAutoRefresh'
import { PendingApproval } from '@/components/dashboard/PendingApproval'
const QuotaUsageDashboard = nextDynamic(() => import('@/components/QuotaUsageDashboard'), { ssr: false })

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }

  // Get user profile, menus, and check if user is admin
  const [profile, menus, currentUser] = await Promise.all([
    userOperations.getProfile(user.id),
    menuOperations.getUserMenus(user.id),
    getCurrentUser()
  ])
  
  const isAdmin = currentUser?.role === 'admin'

  // APPROVAL GATE
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

  // Show dashboard even if the user has no menus. Onboarding remains available via links below.

  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      <DashboardAutoRefresh />
      {/* Background image + soft overlay behind header and main */}
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

      <UXHeader userEmail={user.email ?? undefined} isAdmin={isAdmin} />

      {/* Main Content */}
      <main className="container-ux py-10 md:py-12">
        <div className="space-y-8">
          {/* Hero heading (no separate Admin chip; Admin moved into header nav) */}
          <div className="text-center mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
              Welcome back! 👋
            </h1>
            <p className="mt-2 text-white/90 text-hero-shadow-strong">
              Manage your menus, monitor usage, and continue your setup
            </p>
          </div>

          {/* Welcome Section */}
          <div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Plan Info */}
              <UXCard>
                <div className="p-6">
                  <h3 className="text-sm font-medium text-ux-text-secondary">Current Plan</h3>
                  <div className="text-2xl font-bold text-ux-text mt-1 capitalize">
                    {profile?.plan || 'Free'}
                  </div>
                  <p className="text-sm text-ux-text-secondary mt-1">
                    {profile?.plan === 'free' ? '1 menu, 20 items' : 'Unlimited'}
                  </p>
                </div>
              </UXCard>

              {/* Menu Count */}
              <UXCard>
                <div className="p-6">
                  <h3 className="text-sm font-medium text-ux-text-secondary">Your Menus</h3>
                  <div className="text-2xl font-bold text-ux-text mt-1">
                    {menus?.length || 0}
                  </div>
                  <p className="text-sm text-ux-text-secondary mt-1">
                    {menus?.length === 1 ? 'menu created' : 'menus created'}
                  </p>
                </div>
              </UXCard>

              {/* AI Image Generation Summary (moved here into grid) */}
              <UXCard>
                <div className="p-6">
                  <h3 className="text-sm font-medium text-ux-text-secondary">AI Image Generation</h3>
                  <div className="mt-3">
                    <QuotaUsageDashboard variant="summary" showAdminLink={false} unstyled hideTitle />
                  </div>
                </div>
              </UXCard>
            </div>
          </div>

          {/* Menus Section */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <h2 className="text-xl font-semibold text-white text-hero-shadow">
                Your Menus
              </h2>
            </div>

            {menus && menus.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Add Menu CTA tile (glass panel style to stand out) */}
                <Link href="/dashboard/menus/new">
                  <div className="h-full rounded-md bg-gradient-to-br from-ux-primary/30 to-ux-primary/40 border border-ux-primary/40 text-white transition transform hover:brightness-105 hover:-translate-y-[1px]">
                    <div className="p-6 h-full grid place-items-center text-center">
                      <div className="max-w-[220px]">
                        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-white/25 text-white border border-white/40">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="font-semibold text-white text-hero-shadow text-lg">Create New Menu</div>
                        <p className="mt-1 text-xs text-white/90 text-hero-shadow">
                          Start from scratch or upload a photo
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
                {menus.map((menu) => (
                  <MenuCard key={menu.id} menu={menu} />
                ))}
              </div>
            ) : (
              <UXCard>
                <div className="text-center py-12 p-6">
                  <div className="mx-auto h-12 w-12 text-ux-text-secondary mb-4">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-ux-text mb-2">
                    No menus yet
                  </h3>
                  <p className="text-ux-text-secondary mb-6">
                    Create your first digital menu to get started
                  </p>
                  <div className="flex flex-col items-center gap-2">
                    <Link href="/dashboard/menus/new" className="w-full sm:w-auto">
                      <UXButton variant="primary" className="w-full sm:w-auto">Create Your First Menu</UXButton>
                    </Link>
                  </div>
                </div>
              </UXCard>
            )}
          </div>
        </div>
      </main>

      <UXFooter />
    </div>
  )
}