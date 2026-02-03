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
import { PLAN_CONFIGS } from '@/types'
import { getPlanFriendlyName } from '@/lib/utils'
const QuotaUsageDashboard = nextDynamic(() => import('@/components/QuotaUsageDashboard'), { ssr: false })

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }

  // Get user profile, menus, and check if user is admin
  const [profile, menus, currentUser, creatorPackData] = await Promise.all([
    userOperations.getProfile(user.id),
    menuOperations.getUserMenus(user.id),
    getCurrentUser(),
    (async () => {
      const { data: packs, error: packError } = await supabase
        .from('user_packs')
        .select('id, is_free_trial, metadata, edit_window_end')
        .eq('user_id', user.id)
        .eq('pack_type', 'creator_pack')
        .gt('expires_at', new Date().toISOString())

      if (packError || !packs) return { count: 0, latestEditWindowEnd: null }

      const countablePacks = packs.filter(pack => !pack.is_free_trial || !!pack.metadata?.transaction_id)
      
      // Find the latest edit window end date
      let latestEditWindowEnd: Date | null = null
      packs.forEach(pack => {
        if (pack.edit_window_end) {
          const date = new Date(pack.edit_window_end)
          if (!latestEditWindowEnd || date > latestEditWindowEnd) {
            latestEditWindowEnd = date
          }
        }
      })

      return { 
        count: countablePacks.length, 
        latestEditWindowEnd 
      }
    })()
  ])
  
  // TS inference for Promise.all can be finicky here; keep the shape explicit.
  const creatorPackDataTyped = creatorPackData as { count: number; latestEditWindowEnd: Date | null }
  const creatorPackCount = creatorPackDataTyped.count
  const latestEditWindowEnd = creatorPackDataTyped.latestEditWindowEnd
  const isAdmin = currentUser?.role === 'admin'
  const isSubscriber = ['grid_plus', 'grid_plus_premium', 'premium', 'enterprise'].includes(profile?.plan ?? 'free')

  // Check if user has reached menu limit
  const { allowed: canCreateMenu, limit: menuLimit } = await userOperations.checkPlanLimits(user.id, 'menus', profile || undefined)

  const isEditWindowExpired = (() => {
    if (isAdmin) return false
    if (isSubscriber) return false
    if (!profile) return true
    // Free users can edit for 1 week after signup (onboarding grace)
    const signupGraceMs = 7 * 24 * 60 * 60 * 1000
    const withinSignupGrace = (Date.now() - profile.createdAt.getTime()) < signupGraceMs
    if (withinSignupGrace) return false
    // Active creator pack edit windows keep editing enabled
    if (latestEditWindowEnd instanceof Date && latestEditWindowEnd.getTime() > Date.now()) return false
    return true
  })()

  const formatRemainingTime = (expiryDate: Date) => {
    const now = new Date()
    const diff = expiryDate.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`
    }
    return `${hours}h remaining`
  }

  const getPlanLimits = (plan: string | undefined, effectiveMenuLimit?: number) => {
    const planKey = (plan || 'free') as keyof typeof PLAN_CONFIGS
    const config = PLAN_CONFIGS[planKey] || PLAN_CONFIGS.free
    
    if (planKey === 'free') return `1 menu, ${config.menuItems} items`
    
    const menuLimit = typeof effectiveMenuLimit === 'number' ? effectiveMenuLimit : config.menus
    if (menuLimit === -1) return 'Unlimited menus'
    return `Up to ${menuLimit} active menus`
  }

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
        <main className="container-ux py-10 md:py-12 flex-1">
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
      <main className="container-ux py-10 md:py-12 flex-1">
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-ux-primary/15 px-4 py-2 text-base font-semibold text-ux-primary shadow-sm">
                      {getPlanFriendlyName(profile?.plan)}
                    </span>
                    {creatorPackCount > 0 && (
                      <span className="text-sm font-medium text-ux-text">
                        + {creatorPackCount} Creator Pack{creatorPackCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ux-text-secondary mt-2">
                    {getPlanLimits(profile?.plan, menuLimit)}
                  </p>
                  {profile?.plan === 'free' && latestEditWindowEnd && (
                    <div className="mt-4 pt-4 border-t border-ux-border">
                      <div className="flex items-center gap-2 text-xs font-medium text-ux-text-secondary">
                        <svg className="h-4 w-4 text-ux-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Editing window: {formatRemainingTime(latestEditWindowEnd)}</span>
                      </div>
                    </div>
                  )}
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
                    {menuLimit === -1
                      ? 'menus created'
                      : `of ${menuLimit} menus used`}
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
                {canCreateMenu ? (
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
                ) : (
                  <Link href="/pricing">
                    <div className="h-full rounded-md bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/40 text-white transition transform hover:brightness-105 hover:-translate-y-[1px]">
                      <div className="p-6 h-full grid place-items-center text-center">
                        <div className="max-w-[220px]">
                          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-white/25 text-white border border-white/40">
                            <svg className="h-5 w-5 text-amber-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                            </svg>
                          </div>
                          <div className="font-semibold text-white text-hero-shadow text-lg">Limit Reached</div>
                          <p className="mt-1 text-xs text-white/90 text-hero-shadow">
                            You've reached your limit of {menuLimit} {menuLimit === 1 ? 'menu' : 'menus'}. Upgrade to create more!
                          </p>
                          <div className="mt-3 inline-block bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-medium border border-white/30 transition-colors">
                            Upgrade Now
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
                {menus.map((menu) => (
                  <MenuCard key={menu.id} menu={menu} isEditLocked={isEditWindowExpired} />
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
                    {canCreateMenu ? (
                      <Link href="/dashboard/menus/new" className="w-full sm:w-auto">
                        <UXButton variant="primary" className="w-full sm:w-auto">Create Your First Menu</UXButton>
                      </Link>
                    ) : (
                      <Link href="/pricing" className="w-full sm:w-auto">
                        <UXButton variant="primary" className="w-full sm:w-auto">Upgrade to Create Menu</UXButton>
                      </Link>
                    )}
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