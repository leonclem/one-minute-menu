import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Menu Upload | GridMenu',
  description: 'Upload your menu and proceed to extraction in a streamlined flow.',
}

export default async function MenuUxLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="ux-implementation min-h-dvh md:min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image + soft overlay behind header and main, does not affect layout height */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/ux/backgrounds/kung-pao-chicken.png)`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%'
        }}
      />
      <UXHeader userEmail={user?.email ?? undefined} />
      <main className="flex-1">
        {children}
      </main>
      <UXFooter />
    </div>
  )}


