import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'
import HomeBg from '../../../.kiro/specs/ux-implementation/Background Images/Home.png'

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

export default function UXLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="ux-implementation min-h-dvh md:min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image + soft overlay behind header and main, does not affect layout height */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(${HomeBg.src})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%'
        }}
      />
      <UXHeader />
      <main className="flex-1 grid place-items-center">
        {children}
      </main>
      <UXFooter />
    </div>
  )
}