export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth-utils'
import { UXHeader, UXFooter } from '@/components/ux'
import { CurrencySettings } from './_components/CurrencySettings'
import { BillingSettings } from './_components/BillingSettings'
import { RestaurantSettings } from './_components/RestaurantSettings'
import { getBillingCurrency, canChangeBillingCurrency } from '@/lib/billing-currency-service'
import { getMenuCurrency } from '@/lib/menu-currency-service'
import { userOperations } from '@/lib/database'
import { getFeatureFlag } from '@/lib/feature-flags'
import { isAccountPendingApproval } from '@/lib/account-approval'
import { shouldShowLegacyMenuNav } from '@/lib/product-mode'
import { PendingApproval } from '@/components/dashboard/PendingApproval'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }

  const currentUser = await getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'
  const showLegacySettings = shouldShowLegacyMenuNav()

  // Fetch all settings server-side to avoid client loading flash
  const [profile, menuCurrency, billingCurrency, billingCanChange, requireAdminApproval] = await Promise.all([
    userOperations.getProfile(user.id),
    getMenuCurrency(user.id),
    getBillingCurrency(user.id),
    canChangeBillingCurrency(user.id),
    getFeatureFlag('require_admin_approval'),
  ])

  if (
    isAccountPendingApproval({
      requireAdminApproval,
      isAdmin,
      isApproved: profile?.isApproved,
    })
  ) {
    return (
      <div className="ux-implementation ux-studio-surface relative flex min-h-screen flex-col overflow-x-hidden">
        <UXHeader userEmail={user.email ?? undefined} isAdmin={false} />
        <main className="container-ux flex-1 py-10 md:py-12">
          <PendingApproval email={user.email} />
        </main>
        <UXFooter />
      </div>
    )
  }

  return (
    <div className="ux-implementation ux-studio-surface relative flex min-h-screen flex-col overflow-x-hidden">
      <UXHeader userEmail={user.email ?? undefined} isAdmin={isAdmin} />

      <main className="container-ux w-full flex-1 py-10 md:py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] text-white md:text-4xl">
              Account Settings
            </h1>
            <p className="mt-2 text-white/60">
              {showLegacySettings
                ? 'Manage your currency preferences and account settings'
                : 'Manage your account and billing'}
            </p>
          </div>

          {/* Restaurant Details */}
          {showLegacySettings && (
            <RestaurantSettings
              userId={user.id}
              initialRestaurantName={profile?.restaurantName}
              initialEstablishmentType={profile?.establishmentType}
              initialPrimaryCuisine={profile?.primaryCuisine}
              initialUsername={profile?.username}
              initialDefaultVenueInfo={profile?.defaultVenueInfo}
            />
          )}

          {/* Currency Settings */}
          {showLegacySettings && (
            <CurrencySettings
              userId={user.id}
              initialMenuCurrency={menuCurrency}
            />
          )}

          {/* Billing Settings */}
          <BillingSettings
            userId={user.id}
            initialBillingCurrency={billingCurrency}
            initialCanChangeBilling={billingCanChange.allowed}
            initialBillingChangeReason={billingCanChange.reason}
          />
        </div>
      </main>

      <UXFooter />
    </div>
  )
}
