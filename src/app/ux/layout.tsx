import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'
import { getCurrentUser } from '@/lib/auth-utils'

export const metadata: Metadata = {
  title: 'Create Your Digital Menu | GridMenu',
  description: 'Transform your restaurant menu into a mobile-friendly QR code menu in minutes. Upload your existing menu or try our demo - no credit card required.',
  keywords: ['QR menu', 'digital menu', 'restaurant menu', 'mobile menu', 'QR code menu'],
  openGraph: {
    title: 'Create Your Digital Menu | GridMenu',
    description: 'Transform your restaurant menu into a mobile-friendly QR code menu in minutes.',
    type: 'website',
  },
}

export default async function UXLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <div className="ux-implementation min-h-dvh md:min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image fixed to viewport so tall UX pages scroll over it without stretching */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/ux/backgrounds/kung-pao-chicken.png)`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%'
        }}
      />
      <a href="#ux-main-content" className="sr-only-focusable">
        Skip to main content
      </a>
      <UXHeader userEmail={user?.email} />
      <main id="ux-main-content" className="flex-1 grid place-items-center">
        {children}
      </main>
      <UXFooter />
    </div>
  )
}