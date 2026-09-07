import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'
import { UXAnalyticsProvider } from '@/components/ux'
import { getCurrentUser } from '@/lib/auth-utils'
import { STUDIO_SEO, studioOpenGraph } from '@/lib/studio/public-seo'

export const metadata: Metadata = {
  title: STUDIO_SEO.title,
  description: STUDIO_SEO.description,
  openGraph: studioOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    images: ['/logos/social-1200x630.png'],
  },
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <div className="ux-implementation ux-studio-surface min-h-dvh md:min-h-screen flex flex-col overflow-x-hidden relative">
      <a href="#ux-main-content" className="sr-only-focusable">
        Skip to main content
      </a>
      <UXHeader userEmail={user?.email} />
      <UXAnalyticsProvider>
        <main id="ux-main-content" className="flex-1 w-full">
          {children}
        </main>
      </UXAnalyticsProvider>
      <UXFooter />
    </div>
  )
}
