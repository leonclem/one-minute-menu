'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Camera, Share2, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { UXButton, UxFaqAccordion, UxStudioCtaBand } from '@/components/ux'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'
import { getAuthenticatedHomePath } from '@/lib/product-mode'
import { STUDIO_PUBLIC_FAQS } from '@/lib/studio/public-faqs'
import { STUDIO_SEO } from '@/lib/studio/public-seo'

const WORKFLOW_STEPS: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: 'Upload a real photo',
    body: 'Use a photo that you have taken of any dish. This is the source of truth.',
    icon: Camera,
  },
  {
    title: 'Stage controlled edits',
    body: 'Pick lighting, backdrop, surface, and remove elements from the image and generate.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Export, ready to publish',
    body: 'Get professional crops sized for delivery apps and social, fast, without a photoshoot. Iterate in your dish library, then download what you need.',
    icon: Share2,
  },
]

export default function HomePageStudioContent({ initialUser }: { initialUser?: unknown }) {
  const user = initialUser
  const primaryHref = user ? getAuthenticatedHomePath() : '/register'
  const primaryLabel = user ? 'Open Studio' : 'Get started'

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
    if (!user) {
      trackConversionEvent({
        event: 'registration_start',
        metadata: { path: '/', source: 'hero_primary' },
      })
    }
    captureEvent(ANALYTICS_EVENTS.CTA_CLICKED, {
      location: 'hero',
      label: primaryLabel,
    })
  }

  return (
    <div className="w-full">
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

      <section className="ux-food-bleed ux-food-bleed-hero relative w-full min-h-[22rem] md:min-h-[28rem]">
        <div className="container-ux mx-auto max-w-6xl px-6 py-14 md:py-24">
          <div className="max-w-xl text-center md:max-w-lg md:text-left lg:max-w-xl">
            <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.03em] text-white md:text-5xl lg:text-[3.25rem]">
              {STUDIO_SEO.h1}
            </h1>
            <p className="mt-6 text-[1.05rem] leading-relaxed text-white/70 md:mt-8">
              Upload a real dish photo. Choose lighting, background, surface and more, then generate.
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/70 md:mt-5">
              No prompting. Just a simple, friendly interface that delivers precise, predictable results.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row md:mt-10 md:justify-start">
              <Link href={primaryHref} className="w-full sm:w-auto" onClick={handlePrimaryClick}>
                <UXButton variant="primary" size="lg" noShadow className="w-full min-w-[180px] sm:w-auto">
                  {primaryLabel}
                </UXButton>
              </Link>
              <Link href="/pricing" className="w-full sm:w-auto">
                <UXButton variant="outline" size="lg" noShadow className="w-full min-w-[180px] sm:w-auto">
                  See pricing
                </UXButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-14 md:py-20">
        <div className="container-ux mx-auto max-w-6xl px-6">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-[-0.02em] text-white md:text-4xl">
            How AI food photos work
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.title} className="card-ux p-6">
                <span className="mb-4 inline-flex h-9 w-9 items-center justify-center text-[var(--studio-teal,#01b3bf)]">
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-14 md:py-16">
        <div className="container-ux mx-auto max-w-3xl px-6">
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

      <section className="w-full px-4 pb-16 md:px-6 md:pb-20">
        <UxStudioCtaBand
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          onPrimaryClick={handlePrimaryClick}
        />
      </section>
    </div>
  )
}
