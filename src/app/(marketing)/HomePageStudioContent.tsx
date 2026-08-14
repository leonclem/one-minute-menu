'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { UXButton } from '@/components/ux'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'
import { getAuthenticatedHomePath } from '@/lib/product-mode'
import { STUDIO_PUBLIC_FAQS } from '@/lib/studio/public-faqs'
import { STUDIO_SEO } from '@/lib/studio/public-seo'

export default function HomePageStudioContent({ initialUser }: { initialUser?: unknown }) {
  const user = initialUser
  const primaryHref = user ? getAuthenticatedHomePath() : '/register'
  const primaryLabel = user ? 'Open Studio' : 'Join the waitlist'

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

      <section className="relative w-full">
        <div className="container-ux mx-auto max-w-6xl px-6 py-12 md:py-20">
          <div className="max-w-3xl text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
              {STUDIO_SEO.h1}
            </h1>
            <p
              className="text-white/80 text-hero-shadow mt-6 md:mt-8"
              style={{ fontSize: '1.1rem' }}
            >
              Upload a real dish photo. Choose lighting, background, and surface. Generate a
              commercial image without writing a prompt. Private beta - invite only.
            </p>
            <p className="text-base md:text-lg text-white/90 text-hero-shadow mt-4 md:mt-5 font-medium">
              No prompt engineering. The dish stays the dish.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start items-center mt-8 md:mt-10">
              <Link href={primaryHref} className="w-full sm:w-auto" onClick={handlePrimaryClick}>
                <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[200px]">
                  {primaryLabel}
                </UXButton>
              </Link>
              <Link href="/pricing" className="w-full sm:w-auto">
                <UXButton variant="warning" size="lg" className="w-full sm:w-auto min-w-[200px]">
                  How access works
                </UXButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-16">
        <div className="container-ux mx-auto max-w-5xl px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-10">
            How GridMenu works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Upload a real photo',
                body: 'Use a phone snap of the actual dish. That photo is the source of truth.',
              },
              {
                title: 'Stage controlled edits',
                body: 'Pick lighting, backdrop, and surface. Stage a few changes, then generate.',
              },
              {
                title: 'Download or iterate',
                body: 'Keep variants in your dish library. Download what works. Leave feedback if it does not.',
              },
            ].map((step) => (
              <div key={step.title} className="card-ux p-6">
                <h3 className="text-xl font-semibold text-ux-text mb-2">{step.title}</h3>
                <p className="text-ux-text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-16">
        <div className="container-ux mx-auto max-w-3xl px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-10">
            Common questions
          </h2>
          <div className="space-y-2">
            {STUDIO_PUBLIC_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-md border border-ux-border bg-white px-4 py-3 shadow-sm"
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <span className="font-medium text-ux-text">{faq.question}</span>
                  <span className="mt-0.5 shrink-0 text-ux-text-secondary transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="mt-2 text-sm leading-relaxed" style={{ color: 'rgb(55 65 81)' }}>
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-white/70 text-sm">
            Have more questions?{' '}
            <a href="/support" className="text-white underline underline-offset-2 hover:text-white/90">
              Visit our support page
            </a>
          </p>
        </div>
      </section>

      <section
        style={{
          backgroundColor: 'rgb(255, 193, 7)',
          boxShadow: 'inset 0 -12px 24px -4px rgba(0,0,0,0.25)',
        }}
        className="w-full py-20"
      >
        <div className="container-ux mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Ready to try Photo Studio?
          </h2>
          <p className="text-gray-800 mb-10" style={{ fontSize: '1.05rem' }}>
            Join the waitlist. Invited testers get admin-granted credits — not a self-serve plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={primaryHref} className="w-full sm:w-auto" onClick={handlePrimaryClick}>
              <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[220px]">
                {primaryLabel}
              </UXButton>
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto">
              <UXButton
                variant="outline"
                size="lg"
                className="w-full sm:w-auto min-w-[220px] border-gray-800 text-gray-900 hover:bg-black/10"
              >
                How access works
              </UXButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
