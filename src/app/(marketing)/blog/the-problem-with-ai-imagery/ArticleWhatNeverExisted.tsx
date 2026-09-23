'use client'

import Image from 'next/image'
import Link from 'next/link'
import { UXWrapper } from '@/components/ux'
import HeroCompare from '@/components/marketing/hero-compare/HeroCompare'

const ARTICLE_URL = 'https://gridmenu.ai/blog/the-problem-with-ai-imagery'
const ARTICLE_TITLE = "The Problem With AI Imagery Isn't AI. It's What Never Existed"

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: ARTICLE_TITLE,
  description:
    'Some AI food imagery is repellent, but the tool is not the problem. The question is what the image claims to represent, and what we ask AI to invent.',
  datePublished: '2026-09-23',
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
  image: 'https://gridmenu.ai/backgrounds/the-problem-with-ai-imagery.png',
  url: ARTICLE_URL,
}

const SOURCES = {
  guardian: 'https://www.theguardian.com/technology/2026/sep/06/ai-food-menu-images',
  gartner:
    'https://www.gartner.com/en/newsroom/press-releases/2026-09-16-gartner-forecasts-worldwide-ai-spending-to-grow-49-point-5-percent-in-2026',
  gallup: 'https://news.gallup.com/poll/713222/americans-aren-sold-businesses-using-advertising.aspx',
  redditPhotographers:
    'https://www.reddit.com/r/foodphotography/comments/1w99uwi/ai_taking_a_huge_cut_out_of_my_business/',
  foodQuality: 'https://www.sciencedirect.com/science/article/pii/S095032932400051X',
  redditSf: 'https://www.reddit.com/r/sanfrancisco/comments/1uk76cy/yum_slop/',
}

function QuoteCallout({ quote, context }: { quote: string; context: string }) {
  return (
    <aside
      className="my-10 rounded-2xl border-l-4 border-ux-primary px-7 py-6"
      style={{
        background: 'linear-gradient(to right, rgba(1,179,191,0.12), rgba(1,179,191,0.03))',
      }}
    >
      <p className="text-2xl sm:text-3xl font-extrabold text-ux-primary leading-snug mb-2">
        {quote}
      </p>
      <p className="text-base text-gray-700 leading-relaxed">{context}</p>
    </aside>
  )
}

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
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <a
        href={`https://www.tiktok.com/share?url=${encoded}`}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Share on TikTok"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-colors"
        onClick={(event) => {
          if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            event.preventDefault()
            void navigator.share({ title, text: title, url })
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.28 0 .54.04.79.13V9.4a6.84 6.84 0 0 0-.79-.05A6.33 6.33 0 0 0 3.1 15.7a6.33 6.33 0 0 0 6.33 6.33 6.33 6.33 0 0 0 6.33-6.33V8.56a8.19 8.19 0 0 0 4.76 1.52V6.79a4.84 4.84 0 0 1-1-.1z" />
        </svg>
      </a>
    </div>
  )
}

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

function FigureCaption({ children }: { children: string }) {
  return <figcaption className="mt-2 text-sm leading-snug text-gray-500">{children}</figcaption>
}

function FloatedPhoto({
  src,
  alt,
  caption,
  width,
  height,
}: {
  src: string
  alt: string
  caption: string
  width: number
  height: number
}) {
  return (
    <figure className="float-right ml-6 mb-4 w-[58%]">
      <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full rounded-md" />
      <FigureCaption>{caption}</FigureCaption>
    </figure>
  )
}

const SPECTRUM = ['Preserve', 'Enhance', 'Reconstruct', 'Invent'] as const

export default function ArticleWhatNeverExisted() {
  return (
    <UXWrapper className="py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        suppressHydrationWarning
      />
      <div className="max-w-3xl mx-auto">
        <nav aria-label="Breadcrumb" className="mb-8">
          <Link href="/blog" className="text-white/70 hover:text-white text-sm transition-colors">
            ← Blog
          </Link>
        </nav>

        <article className="rounded-2xl bg-white/95 backdrop-blur shadow-lg overflow-hidden">
          <div className="p-8 sm:p-12">
            <figure className="mb-10">
              <Image
                src="/backgrounds/the-problem-with-ai-imagery.png"
                alt="Left: real banana bread enhanced with AI. Right: an obviously fake banana bread."
                width={3490}
                height={1262}
                className="h-auto w-full rounded-lg"
                priority
              />
              <FigureCaption>
                Left: real banana bread, enhanced with AI. Right: banana bread that was invented, and looks it.
              </FigureCaption>
            </figure>

            <header className="mb-10">
              <p className="text-sm font-medium text-ux-primary uppercase tracking-wide mb-3">
                Photo Studio
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                {ARTICLE_TITLE}
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-3">
                Part 2: When enhancement becomes invention
              </p>
              <p className="text-sm text-gray-400">23 September 2026</p>
            </header>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed overflow-hidden">
              <FloatedPhoto
                src="/backgrounds/unappetising-ai-menu.png"
                alt="A breaded burger that seems to include spaghetti."
                caption="A breaded burger that seems to include spaghetti."
                width={1076}
                height={1044}
              />
              <p>Some AI-generated food imagery is merely uncanny.</p>
              <p>Some of it is genuinely repellent.</p>
              <p>
                In recent examples highlighted by{' '}
                <a
                  href={SOURCES.guardian}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  The Guardian
                </a>
                , meat looks leathery, bread resembles reptile skin, and dishes have the strange
                sheen of something you might hesitate to eat at all.
                <Cite n={1} href={SOURCES.guardian} />
              </p>
              <p>
                Which is a fairly serious problem when the entire purpose of the image is to make
                someone hungry.
              </p>
              <p>The obvious reaction is to blame AI. But that feels too easy.</p>
              <p>
                A small food business may not have the budget for a professional shoot, stylist,
                designer and post-production. If generative AI can create something that
                communicates &ldquo;we sell burgers&rdquo; for a fraction of the cost, the
                attraction is obvious.
              </p>
              <p>
                The question is whether saving money on producing an image still counts as a saving
                if the result actively puts customers off.
              </p>
            </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-10 clear-right">
                Maybe we&rsquo;re just less easily impressed by AI
              </h2>
              <p>There does seem to be a broader cooling of the initial excitement around generative AI.</p>
              <p>
                Gartner now describes GenAI as firmly in the{' '}
                <a
                  href={SOURCES.gartner}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  Trough of Disillusionment
                </a>
                , the stage where early enthusiasm gives way to harder questions about performance,
                value and return on investment.
                <Cite n={2} href={SOURCES.gartner} />
              </p>
              <p>
                Consumers are becoming more sceptical too. In an August 2026{' '}
                <a
                  href={SOURCES.gallup}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  Bentley University-Gallup survey
                </a>
                , 49% of Americans viewed businesses using AI to create advertising negatively,
                compared with 19% positively.
                <Cite n={3} href={SOURCES.gallup} />
              </p>
              <p>But I am not convinced this means people simply &ldquo;hate AI&rdquo;.</p>
              <p>Maybe we&rsquo;re entering a less-easily-impressed-by-AI era.</p>
              <p>
                The novelty is wearing off. &ldquo;Made with AI&rdquo; is no longer interesting on
                its own. The output still has to be good, useful and appropriate for the job.
              </p>
            </div>

            <QuoteCallout
              quote="Maybe we're entering a less-easily-impressed-by-AI era."
              context="The novelty has worn off. The output still has to be good, useful and appropriate for the job."
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Is the tooling really the issue?
              </h2>
              <p>This matters because there is another side to the story.</p>
              <p>
                A recent{' '}
                <a
                  href={SOURCES.redditPhotographers}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  discussion among food photographers on Reddit
                </a>{' '}
                began with a photographer describing clients moving work to AI. Another product
                photographer said their employer was doing the same, despite the results looking
                worse and not saving much time.
                <Cite n={4} href={SOURCES.redditPhotographers} />
              </p>
              <p>
                The threat to creative livelihoods is real, and it would be disingenuous to pretend
                otherwise.
              </p>
              <p>But imagine a slightly different scenario.</p>
              <p>
                A photographer takes the original image, then uses AI to extend the background,
                remove a distraction, correct the lighting, create another crop or tidy part of the
                scene.
              </p>
              <p>Has something inherently gone wrong because AI was involved?</p>
              <p>
                As long as the food is still represented accurately, is the tooling really the
                issue?
              </p>
              <p>
                AI replacing a creative workflow entirely is not the same thing as AI augmenting
                one. There is a very large territory between those extremes.
              </p>
            </div>

            <QuoteCallout
              quote="As long as the food is still represented accurately, is the tooling really the issue?"
              context="Replacing a creative workflow is not the same thing as augmenting one."
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Preserve, enhance, reconstruct, invent
              </h2>
              <p>A useful way to think about generative editing is as a spectrum:</p>
              <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none p-0">
                {SPECTRUM.map((step, index) => (
                  <li
                    key={step}
                    className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm font-bold text-gray-900"
                  >
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-ux-primary mb-1">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <figure>
                <Image
                  src="/backgrounds/preserve-enhance-reconstruct-invent.png"
                  alt="The same dish shown in four stages, from a straight photograph to a fully invented scene"
                  width={3438}
                  height={1266}
                  className="h-auto w-full rounded-lg"
                />
                <FigureCaption>
                  One dish, four panels. Preserve: colour, crop, exposure. Enhance: same food, better light or background. Reconstruct: an item removed and the table rebuilt, or the frame extended slightly. Invent: a different burger, plate and room that were never photographed.
                </FigureCaption>
              </figure>
              <p>
                At one end are changes such as colour correction, cropping and exposure. The
                underlying subject remains essentially untouched.
              </p>
              <p>
                Move along the spectrum and AI might change the lighting, surface or background, or
                remove distracting objects.
              </p>
              <p>
                Further again, it may need to reconstruct information. Remove an item from a table
                and something has to create the pixels that were previously hidden underneath it.
                Extend the edge of an image and the model has to generate scenery the camera never
                captured.
              </p>
              <p>
                Then there is invention: generating the burger, ingredients, plate and environment
                from scratch.
              </p>
              <p>None of these is inherently wrong.</p>
              <p>
                The more important question is:{' '}
                <strong className="text-gray-900">
                  what does the resulting image claim to represent?
                </strong>
              </p>
              <p>
                An impossible AI-generated trainer floating through space in an advertising campaign
                is obviously a creative concept. Nobody assumes the scene really existed.
              </p>
              <p>A photograph beside a food-delivery listing carries a different implication:</p>
              <p>
                <strong className="text-gray-900">
                  This is approximately what you&rsquo;re going to receive.
                </strong>
              </p>
            </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-10">
                Food makes the boundary obvious
              </h2>
              <p>Interestingly, AI-generated food imagery is not automatically less attractive.</p>
              <p>
                A 2024 study published in <em>Food Quality and Preference</em> found that, when the
                origin of the images was not disclosed, participants often{' '}
                <a
                  href={SOURCES.foodQuality}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  preferred AI-generated food images to real ones
                </a>
                . But when people were told which images were genuine, the real images received a
                significant boost in appeal.
                <Cite n={5} href={SOURCES.foodQuality} />
              </p>
              <p>That makes this more interesting than simply saying &ldquo;AI food looks bad&rdquo;.</p>
              <p>The issue is also about representation and trust.</p>
              <p>
                One comment in a{' '}
                <a
                  href={SOURCES.redditSf}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  San Francisco Reddit discussion about an AI-generated cafe menu
                </a>{' '}
                captured the distinction remarkably well:
                <Cite n={6} href={SOURCES.redditSf} />
              </p>
              <blockquote className="border-l-4 border-gray-200 pl-5 italic text-gray-800">
                &ldquo;surely they could have just made the food and used AI to spruce up the
                background or something.&rdquo;
              </blockquote>
              <p>Exactly.</p>
              <p>
                If the thing being advertised already exists, starting with that real thing gives
                the image a source truth.
              </p>
              <p>Then AI can work around it.</p>
            </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-10">
                Some invention is useful
              </h2>
              <p>This does not mean generative AI should never invent pixels.</p>
              <p>Quite the opposite.</p>
              <p>
                If an unwanted object covers part of a plate, removing it requires the model to
                reconstruct whatever would plausibly have been underneath. If an image needs a
                little more room for a social-media crop, extending the tabletop may be entirely
                reasonable.
              </p>
              <div className="flex justify-center py-2">
                <HeroCompare size="compact" tone="onLight" />
              </div>
              <p>The key is how far the generation moves from the subject that matters.</p>
              <p>Inventing a few centimetres of wooden table is not equivalent to inventing an entire steak.</p>
              <p>So perhaps the principle is not &ldquo;never invent&rdquo;.</p>
              <p>It is:</p>
            </div>

            <QuoteCallout
              quote="Invent around the product before you invent the product."
              context="A few centimetres of table is not the same thing as inventing an entire steak."
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <p className="clear-left">
                The further generation moves from the original subject, the more carefully we should
                ask whether the finished image still represents reality.
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Knowing what not to generate
              </h2>
              <p>
                In{' '}
                <Link
                  href="/blog/remove-the-spoon-not-the-fork"
                  className="text-ux-primary hover:underline"
                >
                  Part 1
                </Link>
                , we wrote about prompt fatigue and why precise generative editing needs better
                controls rather than increasingly elaborate conversations with an AI model.
              </p>
              <p>
                Better control leads naturally to the next question: what should those controls
                allow the model to change?
              </p>
              <p>
                Generative AI is not going away, and nor should it. Used well, it can remove
                tedious work, expand creative possibilities and make high-quality production
                accessible to people who could never justify a traditional shoot for every asset
                they need.
              </p>
              <p>The challenge is not deciding whether AI belongs in the creative process.</p>
              <p>It is deciding what we are comfortable asking it to invent.</p>
              <p>
                For{' '}
                <Link href="/" className="text-ux-primary hover:underline">
                  GridMenu
                </Link>
                , that means starting with the real food and treating it as the source of truth,
                while using generation where it genuinely helps the image around it.
              </p>
              <p className="font-bold text-gray-900">
                Sometimes the smartest use of generative AI is knowing what not to generate.
              </p>
            </div>

            <div className="mt-12 flex justify-center">
              <Link
                href="/"
                className="inline-block rounded-full bg-ux-primary px-8 py-3 text-sm font-semibold text-white hover:bg-ux-primary/90 transition-colors"
              >
                ← Back to GridMenu Home
              </Link>
            </div>

            <ShareButtons url={ARTICLE_URL} title={ARTICLE_TITLE} />

            <footer className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Sources
              </h3>
              <ol className="space-y-2 text-xs text-gray-500 list-decimal list-inside">
                <li>
                  <a
                    href={SOURCES.guardian}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    The Guardian: Uncanny and unappetizing: appetites spoil as AI images take over
                    food menus
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.gartner}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Gartner: Worldwide AI spending forecast, September 2026
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.gallup}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Bentley University-Gallup: Americans Aren&rsquo;t Sold on Businesses Using AI in
                    Advertising
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.redditPhotographers}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Reddit, r/foodphotography: AI taking a huge cut out of my business
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.foodQuality}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Food Quality and Preference: Assessing the visual appeal of real/AI-generated
                    food images
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.redditSf}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Reddit, r/sanfrancisco: Yum, slop
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
