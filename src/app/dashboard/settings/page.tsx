export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth-utils'
import { UXHeader, UXFooter, UXCard } from '@/components/ux'
import { CurrencySettings } from './_components/CurrencySettings'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }

  const currentUser = await getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image + soft overlay */}
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
      <main className="container-ux w-full py-10 md:py-12 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
              Account Settings
            </h1>
            <p className="mt-2 text-white/90 text-hero-shadow-strong">
              Manage your currency preferences and account settings
            </p>
          </div>

          {/* Currency Settings */}
          <CurrencySettings userId={user.id} />
        </div>
      </main>

      <UXFooter />
    </div>
  )
}
