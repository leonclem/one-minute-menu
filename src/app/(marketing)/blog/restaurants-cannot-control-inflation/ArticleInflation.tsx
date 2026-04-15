'use client'

import Image from 'next/image'
import Link from 'next/link'
import { UXWrapper } from '@/components/ux'

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Restaurants Cannot Control Inflation. They Can Control This',
  description:
    'Restaurants cannot control inflation or supplier volatility, but they can control how quickly they respond. Here is why menu agility matters more than ever.',
  datePublished: '2026-04-14',
  author: {
    '@type': 'Organization',
    name: 'GridMenu',
    url: 'https://gridmenu.ai',
  },
  publisher: {
    '@type': 'Organization',
    name: 'GridMenu',
    url: 'https://gridmenu.ai',
    logo: {
      '@type': 'ImageObject',
      url: 'https://gridmenu.ai/logos/social-1200x630.png',
    },
  },
  image: 'https://gridmenu.ai/logos/social-1200x630.png',
  url: 'https://gridmenu.ai/blog/restaurants-cannot-control-inflation',
}

/** Floated inline image — half-width with text wrapping around it */
function InlineImage({
  src,
  alt,
  float,
}: {
  src: string
  alt: string
  float: 'left' | 'right'
}) {
  const floatClass =
    float === 'left' ? 'float-left mr-6 mb-4' : 'float-right ml-6 mb-4'
  return (
    <figure className={`${floatClass} w-1/2 rounded-md overflow-hidden clear-none`}>
      <div className="aspect-video relative">
        <Image src={src} alt={alt} fill className="object-cover" />
      </div>
    </figure>
  )
}

/** Inline stat callout with subtle blue gradient tint */
function StatCallout({
  stat,
  context,
  href,
}: {
  stat: string
  context: string
  href: string
}) {
  return (
    <aside
      className="my-10 rounded-2xl border-l-4 border-ux-primary px-7 py-6"
      style={{
        background:
          'linear-gradient(to right, rgba(1,179,191,0.12), rgba(1,179,191,0.03))',
      }}
    >
      <p className="text-4xl sm:text-5xl font-extrabold text-ux-primary leading-none mb-2">
        {stat}
      </p>
      <p className="text-base text-gray-700 leading-relaxed">
        {context}{' '}
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ux-primary hover:underline text-sm"
        >
          ↗
        </a>
      </p>
    </aside>
  )
}

/** Share buttons for X, LinkedIn, Facebook */
function ShareButtons({ url, title }: { url: string; title: string }) {
  const encoded = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  return (
    <div className="flex items-center gap-3 mt-10 pt-8 border-t border-gray-200">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 mr-1">
        Share
      </span>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Share on LinkedIn"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-[#0A66C2] hover:text-white text-gray-600 transition-colors"
      >
        {/* LinkedIn icon */}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Share on Facebook"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-[#1877F2] hover:text-white text-gray-600 transition-colors"
      >
        {/* Facebook icon */}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>
      <a
        href={`https://x.com/intent/tweet?url=${encoded}&text=${encodedTitle}`}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Share on X"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-colors"
      >
        {/* X (Twitter) icon */}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
    </div>
  )
}

/** Superscript citation link */
function Cite({ n, href }: { n: number; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-ux-primary hover:underline text-xs align-super ml-0.5"
      aria-label={`Source ${n}`}
    >
      [{n}]
    </a>
  )
}

const SOURCES = {
  nra: 'https://www.restaurant.org/research-and-media/media/press-releases/persistent-cost-increases-and-enduring-demand-will-shape-the-restaurant-industry-in-2026/',
  abs: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release',
  dal: 'https://www.dal.ca/sites/agri-food/research/canada-s-food-price-report-2026.html',
  ons: 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/consumerpriceinflation/december2025',
}

export default function ArticleInflation() {
  return (
    <UXWrapper className="py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        suppressHydrationWarning
      />
      <div className="max-w-3xl mx-auto">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <Link
            href="/blog"
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            ← Blog
          </Link>
        </nav>

        <article className="rounded-2xl bg-white/95 backdrop-blur shadow-lg overflow-hidden">
          <div className="p-8 sm:p-12">

            {/* Header image */}
            <div className="w-full aspect-video relative overflow-hidden rounded-lg mb-10 bg-gray-100 flex items-center justify-center">
              {/* TODO: replace src with actual header image */}
              <Image
                src="/backgrounds/ship-on-rough-sea-foreshadow.png"
                alt="A large ship carrying oil, on rough seas.  A man's face faded into the sky looks ominous, looking on"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Article header */}
            <header className="mb-10">
              <p className="text-sm font-medium text-ux-primary uppercase tracking-wide mb-3">
                Operations
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                Restaurants Cannot Control Inflation. They Can Control This
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-3">
                Restaurants cannot control the wider market. They can control how quickly they
                adapt to it. That is why menu workflow matters more than it once did.
              </p>
              <p className="text-sm text-gray-400">15 April 2026</p>
            </header>

            {/* Body */}
            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <p>
                Restaurants cannot control inflation, labour pressure, supplier volatility, or the
                wider mood of economic uncertainty. What they can control is how quickly they
                respond.
              </p>
              <p>That matters more than it used to.</p>
              <p>
                Last year,{' '}
                <strong className="text-gray-900">
                  42% of restaurant operators in the US said their business was not profitable
                </strong>
                . In that kind of environment, even small sources of friction start to matter.
                <Cite n={1} href={SOURCES.nra} />
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Menus are increasingly tied to operational guile
              </h2>
              <p>
                For many operators, menus used to be something you refreshed occasionally. A price
                update here, a reprint there, perhaps a broader redesign once in a while.
              </p>
              <p>That feels less realistic now.</p>
              <p>
                Even before this latest global economic uncertainty, in Australia,{' '}
                <strong className="text-gray-900">
                  meals out and takeaway food prices rose 3.7% in the 12 months to February 2026
                </strong>
                .<Cite n={2} href={SOURCES.abs} /> In the UK, food and non-alcoholic beverage
                prices rose{' '}
                <strong className="text-gray-900">
                  4.5% in the 12 months to December 2025
                </strong>
                .<Cite n={4} href={SOURCES.ons} /> Markets differ, of course, but the pattern is
                familiar: costs move, and menus cannot stay static for long.
              </p>
            </div>

            {/* Stat 1 */}
            <StatCallout
              stat="3.7%"
              context="Meals out and takeaway food prices rose 3.7% in Australia over the year to February 2026."
              href={SOURCES.abs}
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed overflow-hidden">
              <p>
                Menus sit right at the intersection of pricing, availability, promotions, and guest
                communication. When those things change faster than the menu does, the menu can start to
                work against the business rather than for it.
              </p>
            </div>

              {/* Body image 1 — floated right */}
              {/* TODO: replace src with actual in-body image (menu editing on laptop/tablet) */}
              <div className="mt-6">
                <InlineImage
                  src="/backgrounds/chef-refrigerator.png"
                  alt="A chef standing in a restaurant kitchen, staring into the refrigerator"
                  float="right"
                />
              </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Why flexibility matters more than perfection
              </h2>
              <p>
                Canada&rsquo;s Food Price Report 2026 says food prices are now{' '}
                <strong className="text-gray-900">
                  27% higher than they were five years ago
                </strong>
                .<Cite n={3} href={SOURCES.dal} /> That kind of longer-term pressure changes how
                operators think about everyday decisions, including pricing, promotions,
                substitutions, and how often menus need to evolve.
              </p>
              <p>
                In that kind of environment, flexibility often matters more than perfection.
              </p>
              <p>
                A restaurant does not always need a grand redesign. It may simply need to update
                quickly, keep formats aligned, and avoid the slow admin cycle that turns simple menu
                changes into a bigger task than they should be.
              </p>
            </div>

            {/* Stat 2 */}
            <StatCallout
              stat="27%"
              context="Food prices in Canada are 27% higher than they were five years ago."
              href={SOURCES.dal}
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4 clear-right">
                The hidden drag in traditional menu production
              </h2>
              <p>The administration of a menu update often sounds simple until the work begins.</p>
              <p>
                Someone has to update the copy. Someone has to handle layout. Someone has to check
                prices. Someone has to produce files for print. If photos are needed, someone has 
                to prepare the dishes and someone has to shoot them. Then there is the delay of
                reprinting, replacing worn copies, or simply living with inaccuracies until the
                next update cycle.
              </p>
              <p>None of this is usually catastrophic by itself. The issue is cumulative drag.</p>
              <p>
                The goal is to make <strong className="text-gray-900">menu creation and updating</strong> less brittle.
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                A quieter, more honest benefit
              </h2>
              <p>
                There may be cost savings here, yes. But that is probably not the most convincing
                way to frame it.
              </p>
              <p>
                No menu platform is going to solve the wider economic pressures facing hospitality.
                It is not going to fix inflation, labour shortages, or supplier instability. Yet it
                removes one avoidable source of friction — and that is where a{' '}
                <Link href="/" className="text-ux-primary hover:underline">
                  menu creation tool like GridMenu
                </Link>{' '}
                quietly pays for itself.
              </p>
              <p>That is a modest claim. But in a difficult market, modest gains are still useful.</p>
              <p>
                Less coordinating providers. Fewer version-control problems. Faster updates. Less lag between
                deciding on a change and seeing it reflected in the menu.
              </p>
              <p>That is not a miracle. It is just operationally helpful.</p>
            </div>

            {/* Body image 2 — floated left */}
            {/* TODO: replace src with actual in-body image (printed menu + digital preview) */}
            <div className="overflow-hidden mt-6">
              <InlineImage
                src="/backgrounds/desk-menu-editing.png"
                alt="A desk with a laptop, editing a menu with existing menus scattered around the table."
                float="left"
              />

              <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4 clear-left">
                  Final thought
                </h2>
                <p>Restaurants cannot control the wider market.</p>
                <p>They can control how quickly they adapt to it.</p>
                <p>
                  That is why menu workflow matters more than it once did. Not because it is the
                  single biggest issue in hospitality, but because it touches pricing,
                  communication, operations, and presentation all at once.
                </p>
                <p>
                  A better workflow will not fix everything. It may, however, make one important
                  part of the job simpler, faster, and easier to keep current.
                </p>
                <p>And right now, that is valuable enough.</p>
              </div>
            </div>

            {/* Back to home */}
            <div className="mt-12 flex justify-center">
              <Link
                href="/"
                className="inline-block rounded-full bg-ux-primary px-8 py-3 text-sm font-semibold text-white hover:bg-ux-primary/90 transition-colors"
              >
                ← Back to GridMenu Home
              </Link>
            </div>

            {/* Share */}
            <ShareButtons
              url="https://gridmenu.ai/blog/restaurants-cannot-control-inflation"
              title="Restaurants Cannot Control Inflation. They Can Control This"
            />

            {/* Sources */}
            <footer className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Sources
              </h3>
              <ol className="space-y-2 text-xs text-gray-500 list-decimal list-inside">
                <li>
                  <a
                    href={SOURCES.nra}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    National Restaurant Association — Persistent Cost Increases and Enduring Demand
                    Will Shape the Restaurant Industry in 2026
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.abs}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Australian Bureau of Statistics — Consumer Price Index, Australia, February 2026
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.dal}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Agri-Food Analytics Lab, Dalhousie University — Canada&rsquo;s Food Price
                    Report 2026
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.ons}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Office for National Statistics — Consumer price inflation, UK: December 2025
                  </a>
                </li>
              </ol>
            </footer>

          </div>
        </article>
      </div>
    </UXWrapper>
  )
}
