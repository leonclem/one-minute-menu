'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { UXButton } from '@/components/ux'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { supabase } from '@/lib/supabase'

/**
 * SlidePanel — bleeds off the anchored edge, stops ~25% short of the far edge.
 *
 * Layout logic (left panel example):
 *   - Pull flush to left viewport edge:  ml-[calc(-1*(50vw-50%))]
 *   - Compensate inner padding on left:  pl-[calc(50vw-50%+1rem)]
 *   - Stop 25% short of far edge:        mr-[25%]  (desktop); mr-[5%] on mobile
 *
 * Depth/opacity: panels start lighter (opacity-60) and darken as they enter view.
 * Accent glow: a thin gradient line on the anchored edge reinforces the "wall" feel.
 * Stagger: children receive a CSS custom property --stagger-index for cascade delays.
 */
function SlidePanel({
  side,
  depth = 1,
  children,
  className = '',
}: {
  side: 'left' | 'right'
  /** 1 = lightest (first panel), increases toward bottom */
  depth?: number
  children: React.ReactNode | ((visible: boolean) => React.ReactNode)
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Background alpha scales from 0.25 (depth 1) → 0.55 (depth 6+), content stays fully opaque
  // Using hardcoded teal RGB (1 179 191) since CSS var interpolation in rgba() needs modern syntax
  const bgAlpha = Math.min(0.25 + (depth - 1) * 0.06, 0.55)
  const bgStyle: React.CSSProperties = {
    position: 'relative',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateX(0)' : side === 'left' ? 'translateX(-2.5rem)' : 'translateX(2.5rem)',
    transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
  }
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    // rgba with hardcoded teal values — works reliably cross-browser
    backgroundColor: `rgba(1, 179, 191, ${bgAlpha})`,
    pointerEvents: 'none',
  }

  const roundedSide = side === 'left' ? 'rounded-r-2xl' : 'rounded-l-2xl'

  // Bleed flush to anchored edge; stop ~25% short on desktop, ~5% on mobile
  const bleedClass =
    side === 'left'
      ? 'ml-[calc(-1*(50vw-50%))] pl-[calc(50vw-50%+1rem)] mr-[5%] md:mr-[25%]'
      : 'mr-[calc(-1*(50vw-50%))] pr-[calc(50vw-50%+1rem)] ml-[5%] md:ml-[25%]'

  // Thin accent glow on the anchored edge (hardcoded teal rgba for cross-browser reliability)
  const accentGlow =
    side === 'left'
      ? 'border-l-2 border-l-[#01B3BF] shadow-[-4px_0_16px_0_rgba(1,179,191,0.5)]'
      : 'border-r-2 border-r-[#01B3BF] shadow-[4px_0_16px_0_rgba(1,179,191,0.5)]'

  return (
    <div
      ref={ref}
      style={bgStyle}
      className={[
        bleedClass,
        roundedSide,
        accentGlow,
        className,
      ].join(' ')}
    >
      {/* Semi-transparent background overlay — keeps content at full opacity */}
      <div style={overlayStyle} aria-hidden="true" />
      <div style={{ position: 'relative' }}>
        {typeof children === 'function' ? children(visible) : children}
      </div>
    </div>
  )
}

/** Wraps direct children so each gets a staggered fade-up on panel entry */
function StaggerChildren({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return (
    <>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={i}
              className="transition-all duration-500 ease-out"
              style={{
                transitionDelay: visible ? `${i * 80}ms` : '0ms',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
              }}
            >
              {child}
            </div>
          ))
        : children}
    </>
  )
}

const homepageFaqs: Array<{ question: string; answer: string }> = [
  {
    question: 'How long does it take to create a menu?',
    answer:
      'Most users have a polished, ready-to-use menu in under 5 minutes. Add your dishes and prices, pick a style, and GridMenu generates the layout and AI food photos automatically — no waiting around.',
  },
  {
    question: 'Do I need design skills to use GridMenu?',
    answer:
      'Not at all. GridMenu takes care of typography, layout, and even food photos. You focus on your dishes and prices — the design is handled automatically.',
  },
  {
    question: 'Can I use my existing menu as a starting point?',
    answer:
      'Yes. You can take a photo of your current menu and GridMenu will extract your dishes and prices so you don\u2019t have to type everything from scratch.',
  },
  {
    question: 'Can I export my menu as a PDF?',
    answer:
      'Absolutely. Every menu you create can be exported as a print-ready PDF or shared digitally with a link your customers can open on any device.',
  },
  {
    question: 'How many menu styles are available?',
    answer:
      'GridMenu offers thousands of style combinations. You can mix fonts, colours, and layouts to find something that fits your venue — and switch styles any time without re-entering your dishes.',
  },
  {
    question: 'Do I need to hire a food photographer?',
    answer:
      'No. GridMenu uses AI to generate appetizing food photos for your dishes automatically, so your menu looks professional without a photo shoot.',
  },
]

export default function HomePageContent({ initialUser }: { initialUser: any }) {
  const [user, setUser] = useState<any>(initialUser ?? null)

  useEffect(() => {
    // Re-check auth on client (session may differ from server)
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    }
    checkUser()

    // Track landing page view
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
    description:
      'Create a restaurant menu online in minutes with GridMenu. Add dishes and prices, choose a style, and generate polished digital or PDF-ready menus.',
  }

  const faqPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: homepageFaqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  const handlePrimaryClick = () => {
    const destination = user ? '/dashboard' : '/register'
    trackConversionEvent({
      event: 'cta_click_primary',
      metadata: { path: '/', destination },
    })
    if (!user) {
      trackConversionEvent({
        event: 'registration_start',
        metadata: { path: '/', source: 'hero_primary' },
      })
    }
  }

  const handleSecondaryClick = () => {
    trackConversionEvent({
      event: 'cta_click_secondary',
      metadata: { path: '/', destination: '/demo/sample', source: 'hero_secondary' },
    })
  }

  return (
    <div className="w-full">
      {/* JSON-LD structured data */}
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

      {/* Hero Section */}
      <section className="relative w-full">
        <div className="container-ux mx-auto max-w-4xl px-6 py-20 md:py-32 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Create your restaurant menu in under 5 minutes
          </h1>
          <p
            className="text-white/80 max-w-2xl mx-auto text-hero-shadow mt-6 md:mt-8"
            style={{ fontSize: '1.1rem' }}
          >
            Enter your dishes and prices, choose a menu style, and GridMenu does the rest —
            layout, food photos, and a finished menu ready for digital sharing or PDF export.
          </p>
          <p className="text-base md:text-lg text-white/90 max-w-2xl mx-auto text-hero-shadow mt-4 md:mt-5 font-medium">
            No designer. No photographer. No complicated tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-8 md:mt-10">
            <Link
              href={user ? '/dashboard' : '/register'}
              className="w-full sm:w-auto"
              onClick={handlePrimaryClick}
            >
              <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[240px]">
                Start with my menu
              </UXButton>
            </Link>
            <Link
              href="/demo/sample"
              className="w-full sm:w-auto"
              onClick={handleSecondaryClick}
            >
              <UXButton variant="warning" size="lg" className="w-full sm:w-auto min-w-[240px]">
                Try a demo menu
              </UXButton>
            </Link>
          </div>
        </div>
      </section>

      {/* How GridMenu Works — bleeds left */}
      <section className="w-full py-16 overflow-x-hidden">
        <SlidePanel side="left" depth={1} className="border-y border-r border-white/20 shadow-xl p-10 pr-12">
          {(visible) => (
          <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-8">
                How GridMenu works
              </h2>
              <div className="rounded-lg overflow-hidden">
                <Image
                  src="/marketing/how-gridmenu-works.png"
                  alt="How GridMenu works: three steps — add dishes and prices, choose a menu style, get your finished menu"
                  width={1040}
                  height={400}
                  className="w-full h-auto"
                  priority={false}
                />
              </div>
          </div>
          )}
        </SlidePanel>
      </section>

      {/* Menu Gallery — bleeds right */}
      <section className="w-full py-16 overflow-x-hidden">
        <SlidePanel side="right" depth={2} className="border-y border-l border-white/20 shadow-xl p-10 pl-12">
          {(visible) => (
            <div className="max-w-5xl ml-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-4">
                Choose a menu style that fits your brand
              </h2>
              <p className="text-white/90 text-center max-w-2xl mx-auto mb-10" style={{ fontSize: '1.05rem', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                Every restaurant has its own personality. GridMenu offers thousands of style combinations so your menu looks exactly right for your venue.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StaggerChildren visible={visible}>
                  <Image
                    src="/marketing/hannahs-cafe.png"
                    alt="Hannah's Café menu created with GridMenu — a warm, café-style menu design"
                    width={600}
                    height={800}
                    className="rounded-lg w-full h-auto"
                  />
                  <Image
                    src="/marketing/fonde-de-la-noche.png"
                    alt="Fonde de la Noche menu created with GridMenu — a rich, moody restaurant menu design"
                    width={600}
                    height={800}
                    className="rounded-lg w-full h-auto"
                  />
                  <Image
                    src="/marketing/duck-fat-combined.png"
                    alt="Duck Fat restaurant menu created with GridMenu — a premium, modern menu design"
                    width={600}
                    height={800}
                    className="rounded-lg w-full h-auto"
                  />
                </StaggerChildren>
              </div>
            </div>
          )}
        </SlidePanel>
      </section>
      {/* Benefits Section — bleeds left */}
      <section className="w-full py-16 overflow-x-hidden">
        <SlidePanel side="left" depth={3} className="border-y border-r border-white/20 shadow-xl p-10 pr-12">
          {(visible) => (
          <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-10">
                Why food and beverage businesses use GridMenu
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <StaggerChildren visible={visible}>
                  <div className="card-ux p-6">
                    <h3 className="text-xl font-semibold text-ux-text mb-2">AI food photos — no photographer needed</h3>
                    <p className="text-ux-text-secondary">
                      Every dish gets an appetizing AI-generated photo. Your menu looks polished and professional without a photo shoot.
                    </p>
                  </div>
                  <div className="card-ux p-6">
                    <h3 className="text-xl font-semibold text-ux-text mb-2">Save time on menu creation</h3>
                    <p className="text-ux-text-secondary">
                      Go from a list of dishes to a finished, professional menu in minutes — not hours. No back-and-forth with a designer.
                    </p>
                  </div>
                  <div className="card-ux p-6">
                    <h3 className="text-xl font-semibold text-ux-text mb-2">No design skills required</h3>
                    <p className="text-ux-text-secondary">
                      GridMenu handles typography, layout, and spacing automatically. You just focus on your food and prices.
                    </p>
                  </div>
                  <div className="card-ux p-6">
                    <h3 className="text-xl font-semibold text-ux-text mb-2">Digital and PDF-ready output</h3>
                    <p className="text-ux-text-secondary">
                      Share your menu as a link customers can open on any device, or export a print-ready PDF for physical menus.
                    </p>
                  </div>
                </StaggerChildren>
              </div>
          </div>
          )}
        </SlidePanel>
      </section>

      {/* Start From Scratch or Existing Menu — bleeds right */}
      <section className="w-full py-16 overflow-x-hidden">
        <SlidePanel side="right" depth={4} className="border-y border-l border-white/20 shadow-xl p-10 pl-12">
            <div className="max-w-5xl ml-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-6">
                Start from scratch — or use an existing menu as a starting point
              </h2>
              <p className="text-white/90 text-center max-w-2xl mx-auto mb-10" style={{ fontSize: '1.05rem', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                Already have a menu? Take a photo and GridMenu will extract your dishes and prices automatically. Or start fresh and build from the ground up — either way takes just minutes.
              </p>
              <div className="relative hidden md:flex gap-9 items-center justify-center">
                {/* Left image — ~30% smaller */}
                <div className="w-[32%] shrink-0">
                  <Image
                    src="/sample-menus/breakfast.jpg"
                    alt="A photo of a printed breakfast menu — the kind you can photograph and upload to GridMenu for automatic extraction"
                    width={800}
                    height={600}
                    className="rounded-lg w-full h-auto"
                  />
                </div>

                {/* Transformation arrow — overlaps both image edges at vertical midpoint */}
                <div
                  className="flex items-center justify-center z-10 shrink-0"
                  aria-hidden="true"
                >
                  <svg width="110" height="90" viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M0 28 H62 V8 L110 45 L62 82 V62 H0 Z"
                      fill="rgb(255, 193, 7)"
                      filter="drop-shadow(0 4px 12px rgba(0,0,0,0.35))"
                    />
                  </svg>
                </div>

                {/* Right image — same height as left */}
                <div className="w-[32%] shrink-0">
                  <Image
                    src="/marketing/hannahs-cafe.png"
                    alt="Hannah's Café menu created with GridMenu — the finished result after extracting and styling a menu"
                    width={600}
                    height={800}
                    className="rounded-lg w-full h-auto"
                  />
                </div>
              </div>

              {/* Mobile fallback — stacked */}
              <div className="md:hidden flex flex-col gap-6 items-center">
                <Image
                  src="/sample-menus/breakfast.jpg"
                  alt="A photo of a printed breakfast menu — the kind you can photograph and upload to GridMenu for automatic extraction"
                  width={800}
                  height={600}
                  className="rounded-lg w-full h-auto"
                />
                <svg width="60" height="50" viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ transform: 'rotate(90deg)' }}>
                  <path d="M0 28 H62 V8 L110 45 L62 82 V62 H0 Z" fill="rgb(255, 193, 7)" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.35))" />
                </svg>
                <Image
                  src="/marketing/hannahs-cafe.png"
                  alt="Hannah's Café menu created with GridMenu — the finished result after extracting and styling a menu"
                  width={600}
                  height={800}
                  className="rounded-lg w-full h-auto"
                />
              </div>
            </div>
        </SlidePanel>
      </section>
      {/* FAQ Section — bleeds left */}
      <section className="w-full py-16 overflow-x-hidden">
        <SlidePanel side="left" depth={7} className="border-y border-r border-white/20 shadow-xl p-10 pr-12">
          <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-hero-shadow mb-10">
                Common questions
              </h2>
              <div className="space-y-2">
                {homepageFaqs.map((faq) => (
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
                    <div className="mt-2 text-sm leading-relaxed" style={{ color: 'rgb(55 65 81)' }}>{faq.answer}</div>
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
        </SlidePanel>
      </section>

      {/* Final CTA — amber/yellow background, visually distinct from teal footer */}
      <CtaSection user={user} onPrimaryClick={handlePrimaryClick} />
    </div>
  )
}

function CtaSection({
  user,
  onPrimaryClick,
}: {
  user: any
  onPrimaryClick: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      style={{
        backgroundColor: 'rgb(255, 193, 7)',
        // Inset shadow at the bottom gives the "tucked behind footer" illusion
        boxShadow: 'inset 0 -12px 24px -4px rgba(0,0,0,0.25)',
      }}
      className="w-full py-20"
    >
      <div
        ref={ref}
        className="container-ux mx-auto max-w-3xl px-6 text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(32px)',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Ready to create your restaurant menu?
        </h2>
        <p className="text-gray-800 mb-10" style={{ fontSize: '1.05rem' }}>
          Get a polished, professional menu in minutes — no designer or photographer needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href={user ? '/dashboard' : '/register'}
            className="w-full sm:w-auto"
            onClick={onPrimaryClick}
          >
            <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[220px]">
              Start with my menu
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
  )
}
