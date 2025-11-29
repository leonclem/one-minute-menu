'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { UXButton } from '@/components/ux'
import { getABVariant, trackConversionEvent } from '@/lib/conversion-tracking'

export default function UXHomePage() {
  // Start with 'A' to match server-side rendering, then update on client
  const [ctaVariant, setCtaVariant] = useState<string>('A')

  useEffect(() => {
    // Get the actual variant on client-side only (after hydration)
    const variant = getABVariant('ux_home_primary_cta', ['A', 'B'])
    setCtaVariant(variant)

    // Track landing page view with the correct variant
    trackConversionEvent({
      event: 'landing_view',
      metadata: {
        path: '/ux',
        ctaVariant: variant,
      },
    })
  }, [])

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.app'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GridMenu UX',
    url: `${siteUrl}/ux`,
    description:
      'Try GridMenu’s new UX flow to transform your restaurant menu into a mobile-friendly QR code menu. Upload your menu or start with a demo.',
  }

  const primaryCtaLabel =
    ctaVariant === 'B' ? '✨ Start with my menu' : '✨ Transform My Menu'

  const handlePrimaryClick = () => {
    trackConversionEvent({
      event: 'cta_click_primary',
      metadata: {
        path: '/ux',
        ctaVariant,
        destination: '/ux/register',
      },
    })
    trackConversionEvent({
      event: 'registration_start',
      metadata: {
        path: '/ux',
        ctaVariant,
        source: 'hero_primary',
      },
    })
  }

  const handleSecondaryClick = () => {
    trackConversionEvent({
      event: 'cta_click_secondary',
      metadata: {
        path: '/ux',
        ctaVariant,
        destination: '/ux/demo/sample',
        source: 'hero_secondary',
      },
    })
    trackConversionEvent({
      event: 'demo_start',
      metadata: {
        path: '/ux',
        ctaVariant,
        source: 'hero_secondary',
      },
    })
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <section className="relative w-full">
        <div className="container-ux mx-auto max-w-4xl px-6 py-8 md:py-12 text-center">
          {/* JSON-LD structured data specific to the UX landing */}
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Ready to create your new beautiful menu in under 5 minutes?
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto text-hero-shadow mt-4 md:mt-6">
            Transform your menu into a print- and mobile-friendly, flexible digital menu. Instant price changes, 86&apos;ing and much more.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-6 md:mt-8">
            <Link href="/ux/register" className="w-full sm:w-auto" onClick={handlePrimaryClick}>
              <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[240px]">
                {primaryCtaLabel}
              </UXButton>
            </Link>
            <Link href="/ux/demo/sample" className="w-full sm:w-auto" onClick={handleSecondaryClick}>
              <UXButton variant="warning" size="lg" className="w-full sm:w-auto min-w-[240px]">
                Try a Demo Menu
              </UXButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
