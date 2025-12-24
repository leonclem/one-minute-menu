import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ClientFlowShell from './ClientFlowShell'
import { UXAnalyticsProvider } from '@/components/ux'

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
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

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
