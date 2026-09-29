'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import HeroCompare from '@/components/marketing/hero-compare/HeroCompare'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { ANALYTICS_EVENTS, captureEvent } from '@/lib/posthog'
import {
  AI_FOOD_PHOTOGRAPHY_CANONICAL,
  AI_FOOD_PHOTOGRAPHY_DESCRIPTION,
  AI_FOOD_PHOTOGRAPHY_FAQS,
  AI_FOOD_PHOTOGRAPHY_H1,
  COMPARISON_ROWS,
} from './copy'
import { AiFoodPhotographyLower } from './AiFoodPhotographyLower'
import {
  AI_FOOD_PHOTOGRAPHY_PRIMARY_LABEL,
  AI_FOOD_PHOTOGRAPHY_STUDIO_HREF,
  trackAiFoodPhotographyCta,
} from './tracking'

export default function AiFoodPhotographyContent() {
  useEffect(() => {
    captureEvent(ANALYTICS_EVENTS.AI_FOOD_PHOTOGRAPHY_PAGE_VIEW, {
      path: '/ai-food-photography',
    })
    trackConversionEvent({
      event: 'landing_view',
      metadata: { path: '/ai-food-photography' },
    })
  }, [])

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: AI_FOOD_PHOTOGRAPHY_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }

  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'GridMenu',
    applicationCategory: 'PhotographyApplication',
    operatingSystem: 'Web',
    url: AI_FOOD_PHOTOGRAPHY_CANONICAL,
    description: AI_FOOD_PHOTOGRAPHY_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'New accounts start with 10 free credits.',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.gridmenu.ai/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AI Food Photography',
        item: AI_FOOD_PHOTOGRAPHY_CANONICAL,
      },
    ],
  }

  return (
    <div className="flex w-full flex-1 flex-col bg-[#0b1114] text-white">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="relative overflow-hidden">
        <div className="container-ux relative z-[1] pb-12 pt-8 md:pb-16 md:pt-12">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-white/55">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-white/80">AI Food Photography</span>
          </nav>
          <div className="flex flex-wrap items-center gap-10 md:gap-14">
            <div className="min-w-0 flex-[1_1_380px] text-center min-[1080px]:text-left">
              <p className="mb-4 text-xs font-bold tracking-[0.16em] text-[#01B3BF]">AI FOOD PHOTOGRAPHY</p>
              <h1 className="mb-6 text-[clamp(32px,4.2vw,52px)] font-extrabold leading-[1.08] tracking-[-0.01em] text-pretty">
                {AI_FOOD_PHOTOGRAPHY_H1}
              </h1>
              <p className="mx-auto max-w-[540px] text-[18px] leading-[1.6] text-white/70 min-[1080px]:mx-0">
                Turn an existing food photo into a polished, studio-quality image with controlled AI editing.
              </p>
              <p className="mx-auto mt-4 max-w-[540px] text-[18px] leading-[1.6] text-white/70 min-[1080px]:mx-0">
                Choose lighting, backgrounds, surfaces and styling without writing prompts, while keeping the real dish at the centre of the image.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 min-[1080px]:justify-start">
                <Link
                  href={AI_FOOD_PHOTOGRAPHY_STUDIO_HREF}
                  onClick={() =>
                    trackAiFoodPhotographyCta('hero', AI_FOOD_PHOTOGRAPHY_PRIMARY_LABEL, AI_FOOD_PHOTOGRAPHY_STUDIO_HREF)
                  }
                  className="inline-flex items-center justify-center rounded-lg bg-[#00b3bf] px-7 py-4 text-[16px] font-bold text-[#04232a] shadow-[0_0_26px_rgba(0,179,191,0.45)] transition hover:brightness-110"
                >
                  {AI_FOOD_PHOTOGRAPHY_PRIMARY_LABEL}
                </Link>
                <a
                  href="#how-it-works"
                  onClick={() => trackAiFoodPhotographyCta('hero', 'See How It Works', '#how-it-works')}
                  className="inline-flex items-center justify-center rounded-lg border border-white/20 px-7 py-4 text-[16px] font-bold text-white transition hover:border-white/40"
                >
                  See How It Works
                </a>
              </div>
              <p className="mx-auto mt-5 max-w-[540px] text-sm text-white/55 min-[1080px]:mx-0">
                Start with your real dish. Change the presentation, not the food.
              </p>
            </div>
            <div className="mx-auto w-full min-w-0 max-w-[420px] flex-[0_1_420px] min-[1080px]:mx-0">
              <HeroCompare />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0f1c1f]">
        <div className="container-ux py-16 md:py-20">
          <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.02em] md:text-4xl">
            AI food photography without starting from scratch
          </h2>
          <div className="mt-6 max-w-3xl space-y-4 text-[17px] leading-relaxed text-white/75">
            <p>Many AI image tools begin with a text prompt and generate a new image.</p>
            <p>GridMenu takes a different approach.</p>
            <p>
              Upload a real photo of your food and use simple controls to change how it is presented. Adjust the scene around the dish while preserving the food itself as the source of truth.
            </p>
            <p>
              That means less prompt-writing, fewer unpredictable changes and a much clearer connection between the image and the food you actually serve, sell or promote.
            </p>
          </div>
          <div className="mt-10">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">How GridMenu differs from generic AI image generation</caption>
              <thead>
                <tr className="border-b border-white/15 text-white/50">
                  <th scope="col" className="w-1/2 py-3 pr-3 align-bottom font-semibold">Generic AI image generation</th>
                  <th scope="col" className="w-1/2 py-3 align-bottom font-semibold text-[#01B3BF]">
                    <span className="inline-flex items-center gap-1.5">
                      <Image src="/logos/logo.svg" alt="" width={16} height={16} className="shrink-0" />
                      GridMenu
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.gridmenu} className="border-b border-white/10">
                    <td className="py-3 pr-3 align-top text-white/65">{row.generic}</td>
                    <td className="py-3 align-top text-white">{row.gridmenu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20">
        <div className="container-ux py-16 md:py-20">
          <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.02em] md:text-4xl">
            From everyday food photo to campaign-ready image
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-2">
            <li>
              <h3 className="text-lg font-bold">1. Upload your real food photo</h3>
              <p className="mt-2 text-white/70">Start with a photo taken on a phone, camera or existing brand asset.</p>
            </li>
            <li>
              <h3 className="text-lg font-bold">2. Choose what you want to change</h3>
              <p className="mt-2 text-white/70">Use simple controls for lighting, tabletop surface, studio backdrop, and garnishes and styling.</p>
            </li>
            <li>
              <h3 className="text-lg font-bold">3. Generate your new image</h3>
              <p className="mt-2 text-white/70">GridMenu applies the requested changes while keeping the original dish as the visual reference.</p>
            </li>
            <li>
              <h3 className="text-lg font-bold">4. Create variants for different channels</h3>
              <p className="mt-2 text-white/70">
                Turn one source photo into versions for restaurant menus, delivery apps, Instagram and social media, websites, marketing campaigns, food-brand content and product launches.
              </p>
            </li>
          </ol>
          <Link
            href={AI_FOOD_PHOTOGRAPHY_STUDIO_HREF}
            onClick={() =>
              trackAiFoodPhotographyCta(
                'how-it-works',
                'Try It With Your Own Photo',
                AI_FOOD_PHOTOGRAPHY_STUDIO_HREF,
              )
            }
            className="mt-10 inline-flex items-center justify-center rounded-lg bg-[#00b3bf] px-7 py-4 text-[16px] font-bold text-[#04232a] transition hover:brightness-110"
          >
            Try It With Your Own Photo
          </Link>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0f1c1f]">
        <div className="container-ux grid gap-12 py-16 md:grid-cols-2 md:py-20">
          <div>
            <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">Control the image, not the prompt</h2>
            <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-white/75">
              <p>Getting a good AI image should not depend on learning how to write increasingly complicated prompts.</p>
              <p>GridMenu replaces prompt engineering with purpose-built food photography controls.</p>
              <p>
                Instead of repeatedly asking a model to remove the spoon but keep the fork, change the background without moving the plate, or improve the lighting without altering the dish, you choose the change you want. GridMenu handles the generation.
              </p>
            </div>
            <p className="mt-6 text-lg font-bold text-[#F8BC02]">Less prompting. More control.</p>
            <p className="mt-4 text-sm text-white/60">
              More on this in{' '}
              <Link href="/blog/remove-the-spoon-not-the-fork" className="font-semibold text-[#5fd3da] hover:text-[#7fdee4]">
                Remove the Spoon, Not the Fork
              </Link>
              .
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">Keep the food real</h2>
            <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-white/75">
              <p>Professional presentation should not require inventing a different dish.</p>
              <p>GridMenu is designed around a simple principle:</p>
              <blockquote className="border-l-2 border-[#01B3BF] pl-4 text-xl font-semibold text-white">
                Transform the presentation. Preserve the identity of the food.
              </blockquote>
              <p>Your uploaded image remains the reference point throughout the editing process.</p>
              <p>
                That is useful when visual accuracy matters, for restaurants, food brands, menu designers, photographers and marketers who want better imagery without replacing the underlying product.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AiFoodPhotographyLower />
    </div>
  )
}
