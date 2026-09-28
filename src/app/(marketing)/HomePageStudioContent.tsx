'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'
import HeroDemo from '@/components/marketing/hero-demo/HeroDemo'
import { STUDIO_SEO } from '@/lib/studio/public-seo'

export default function HomePageStudioContent({ initialUser }: { initialUser?: unknown }) {
  void initialUser
  const primaryHref = '/studio'
  const primaryLabel = 'Open Studio'

  useEffect(() => {
    trackConversionEvent({
      event: 'landing_view',
      metadata: { path: '/' },
    })
  }, [])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.ai'

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GridMenu',
    url: siteUrl,
    description: STUDIO_SEO.description,
  }

  const handlePrimaryClick = () => {
    trackConversionEvent({
      event: 'cta_click_primary',
      metadata: { path: '/', destination: primaryHref },
    })
    captureEvent(ANALYTICS_EVENTS.CTA_CLICKED, {
      location: 'hero',
      label: primaryLabel,
    })
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      <section className="relative flex w-full flex-1 flex-col overflow-hidden bg-[#0b1114]">
        <Image
          src="/backgrounds/kung-pao-chicken.png"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none object-cover"
          style={{
            objectPosition: '38% 32%',
            filter: 'blur(6px) brightness(0.78) saturate(1.15)',
            transform: 'scale(1.08)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(100deg, rgba(11,17,20,.98) 0%, rgba(11,17,20,.93) 26%, rgba(11,17,20,.60) 55%, rgba(11,17,20,.35) 100%)',
          }}
        />
        <div className="container-ux relative z-[1] flex flex-wrap items-center gap-10 pb-16 pt-8 md:gap-14 md:pb-24 md:pt-12">
          <div className="min-w-0 flex-[1_1_380px]">
            <h1 className="mb-[26px] text-[clamp(34px,4.4vw,54px)] font-extrabold leading-[1.08] tracking-[-0.01em] text-pretty text-white">
              {STUDIO_SEO.h1}
            </h1>
            <p className="max-w-[480px] text-[18px] leading-[1.6] text-[rgba(255,255,255,0.66)]">
              Upload a real dish photo. Choose lighting, background, surface and more, then generate.
            </p>
            <p className="mt-4 max-w-[480px] text-[18px] leading-[1.6] text-[rgba(255,255,255,0.66)]">
              No prompting. Just a simple, friendly interface that delivers precise, predictable results.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href={primaryHref}
                onClick={handlePrimaryClick}
                className="inline-flex items-center justify-center rounded-lg bg-[#00b3bf] px-7 py-4 text-[16px] font-bold text-[#04232a] shadow-[0_0_26px_rgba(0,179,191,0.45)] transition hover:brightness-110"
              >
                {primaryLabel}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg border border-white/20 px-7 py-4 text-[16px] font-bold text-white transition hover:border-white/40"
              >
                See pricing
              </Link>
            </div>
          </div>
          <div className="w-full min-w-0 max-w-[560px] flex-[0_1_560px]">
            <HeroDemo />
          </div>
        </div>
        <div
          className="relative z-[1] min-h-48 flex-1"
          style={{
            background:
              'linear-gradient(to bottom, rgba(15,28,31,0) 0%, rgba(15,28,31,0.45) 42%, #0f1c1f 100%)',
          }}
        />
      </section>
    </div>
  )
}
