'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Camera, Share2, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { UXButton } from '@/components/ux'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'
import { getAuthenticatedHomePath } from '@/lib/product-mode'
import { STUDIO_PUBLIC_FAQS } from '@/lib/studio/public-faqs'
import { STUDIO_SEO } from '@/lib/studio/public-seo'

/** Wobbly, hand-drawn connector between workflow steps. */
function SketchFlowArrow({
  direction,
  variant,
  className = '',
}: {
  direction: 'right' | 'down'
  variant: 0 | 1
  className?: string
}) {
  const paths =
    variant === 0
      ? {
          shaft: 'M4 26 C18 14, 28 32, 42 22 C50 16, 56 24, 62 20',
          head: 'M52 11 C58 16, 64 18, 70 20 C62 24, 56 32, 54 36',
        }
      : {
          shaft: 'M3 22 C16 30, 30 12, 44 24 C52 30, 58 18, 63 22',
          head: 'M51 10 C56 15, 63 19, 71 21 C64 26, 58 34, 53 37',
        }

  return (
    <svg
      viewBox="0 0 76 48"
      className={[
        direction === 'down' ? 'h-12 w-16 rotate-90' : 'h-14 w-[4.75rem]',
        className,
      ].join(' ')}
      fill="none"
      aria-hidden="true"
      overflow="visible"
      style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.65))' }}
    >
      {[
        { d: paths.shaft, join: undefined },
        { d: paths.head, join: 'round' as const },
      ].map((path) => (
        <g key={path.d}>
          <path
            d={path.d}
            stroke="rgba(0,0,0,0.55)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin={path.join}
            fill="none"
          />
          <path
            d={path.d}
            stroke="rgb(255, 193, 7)"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin={path.join}
            fill="none"
          />
        </g>
      ))}
    </svg>
  )
}

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
              Upload a real dish photo. Choose lighting, background, surface and more, then generate.
            </p>
            <p className="text-base md:text-lg text-white/90 text-hero-shadow mt-4 md:mt-5 font-medium">
              No prompting. Just a simple, friendly interface that delivers precise, predictable results.
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
        <div className="container-ux mx-auto max-w-6xl px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-10">
            How GridMenu works
          </h2>
          <div className="flex flex-col md:flex-row md:items-stretch gap-2 md:gap-0">
            {(
              [
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
                  body: 'Get professional crops sized for delivery apps and social — fast, without a photoshoot. Iterate in your dish library, then download what you need.',
                  icon: Share2,
                },
              ] as Array<{ title: string; body: string; icon: LucideIcon }>
            ).map((step, index, steps) => (
              <div key={step.title} className="contents">
                <div className="card-ux !bg-white flex-1 p-6">
                  <h3 className="flex items-center gap-3 text-xl font-semibold text-gray-900 mb-2">
                    <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-600">
                      <step.icon className="h-5 w-5 text-white" aria-hidden="true" />
                    </span>
                    {step.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{step.body}</p>
                </div>
                {index < steps.length - 1 ? (
                  <div
                    className="relative z-10 flex flex-shrink-0 items-center justify-center pointer-events-none -my-3 md:my-0 md:-mx-3 md:w-[4.75rem]"
                    aria-hidden="true"
                  >
                    <SketchFlowArrow
                      direction="right"
                      variant={index === 0 ? 0 : 1}
                      className="hidden md:block"
                    />
                    <SketchFlowArrow
                      direction="down"
                      variant={index === 0 ? 0 : 1}
                      className="md:hidden"
                    />
                  </div>
                ) : null}
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
            Sign up and start with 10 free credits. Buy more anytime on the pricing page.
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
                See pricing
              </UXButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
