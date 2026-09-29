'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import { UxFaqAccordion } from '@/components/ux'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'
import { FaqSideDishes } from '@/components/marketing/faq-side-dishes/FaqSideDishes'
import HeroDemo from '@/components/marketing/hero-demo/HeroDemo'
import { STUDIO_PUBLIC_FAQS } from '@/lib/studio/public-faqs'
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

  const faqPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: STUDIO_PUBLIC_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
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
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
      />

      <section className="relative flex w-full flex-col overflow-hidden bg-[#0b1114]">
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
        <div className="container-ux relative z-[1] flex flex-wrap items-center gap-10 pb-4 pt-8 md:gap-14 md:pb-8 md:pt-12">
          <div className="min-w-0 flex-[1_1_380px] text-center min-[1080px]:text-left">
            <h1 className="mb-[26px] text-[clamp(34px,4.4vw,54px)] font-extrabold leading-[1.08] tracking-[-0.01em] text-pretty text-white">
              {STUDIO_SEO.h1}
            </h1>
            <p className="mx-auto max-w-[480px] text-[18px] leading-[1.6] text-[rgba(255,255,255,0.66)] min-[1080px]:mx-0">
              Upload a real dish photo. Choose lighting, background, surface and more, then generate.
            </p>
            <p className="mx-auto mt-4 max-w-[480px] text-[18px] leading-[1.6] text-[rgba(255,255,255,0.66)] min-[1080px]:mx-0">
              No prompting. Just a simple, friendly interface that delivers precise, predictable results.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 min-[1080px]:justify-start">
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
          <div className="mx-auto w-full min-w-0 max-w-[560px] flex-[0_1_560px] min-[1080px]:mx-0">
            <HeroDemo />
          </div>
        </div>
        <div
          className="relative z-[1] h-10 md:h-14"
          style={{
            background:
              'linear-gradient(to bottom, rgba(15,28,31,0) 0%, rgba(15,28,31,0.45) 42%, #0f1c1f 100%)',
          }}
        />
      </section>

      <section className="faq-with-side-dishes relative w-full">
        <FaqSideDishes />
        <div className="container-ux relative z-[1] mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-[-0.02em] text-white md:text-4xl">
            Common questions
          </h2>
          <UxFaqAccordion faqs={STUDIO_PUBLIC_FAQS} />
          <p className="mt-8 text-center text-sm text-white/55">
            Have more questions?{' '}
            <Link href="/support" className="font-semibold text-[var(--studio-link,#5fd3da)] hover:text-[#7fdee4]">
              Visit our support page
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
