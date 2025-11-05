import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'

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
    <div className="ux-implementation min-h-screen bg-white">
      <UXHeader />
      <main className="flex-1">
        {children}
      </main>
      <UXFooter />
    </div>
  )
}