'use client'

import Image from 'next/image'
import Link from 'next/link'
import { UXWrapper } from '@/components/ux'

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Remove the Spoon, Not the Fork',
  description:
    'AI food photo editing still starts with a blank prompt. Photographers end up negotiating over a spoon and a fork. GridMenu replaces that with controls.',
  datePublished: '2026-09-15',
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
  image: 'https://gridmenu.ai/backgrounds/remove-the-spoon-not-the-fork.png',
  url: 'https://gridmenu.ai/blog/remove-the-spoon-not-the-fork',
}

function InlineImage({
  src,
  alt,
  float,
  width,
  height,
}: {
  src: string
  alt: string
  float: 'left' | 'right'
  width: number
  height: number
}) {
  const floatClass = float === 'left' ? 'float-left mr-6 mb-4' : 'float-right ml-6 mb-4'
  return (
    <figure className={`${floatClass} w-[58%] rounded-md overflow-hidden clear-none`}>
      <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full" />
    </figure>
  )
}

function QuoteCallout({
  quote,
  context,
  href,
}: {
  quote: string
  context: string
  href?: string
}) {
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
      <p className="text-base text-gray-700 leading-relaxed">
        {context}
        {href ? (
          <>
            {' '}
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ux-primary hover:underline text-sm"
            >
              ↗
            </a>
          </>
        ) : null}
      </p>
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

const SOURCES = {
  reddit: 'https://www.reddit.com/r/foodphotography/comments/1w99uwi/ai_taking_a_huge_cut_out_of_my_business/',
  promptFatigue:
    'https://cloud.google.com/blog/products/ai-machine-learning/announcing-vertex-ai-prompt-optimizer',
  gemini: 'https://ai.google.dev/gemini-api/docs/image-generation',
  structured: 'https://ai.google.dev/gemini-api/docs/structured-output',
  youtube: 'https://www.youtube.com/watch?v=gcXPW6eBB0w',
  imagen: 'https://research.google/blog/imagen-editor-and-editbench-advancing-and-evaluating-text-guided-image-inpainting/',
}

export default function ArticleRemoveTheSpoon() {
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
            <div className="w-full aspect-video relative overflow-hidden rounded-lg mb-10">
              <Image
                src="/backgrounds/remove-the-spoon-not-the-fork.png"
                alt="An overhead photo of grilled eggplant with salad, a fork on the plate, and a spare spoon to the side"
                fill
                className="object-cover"
                priority
              />
            </div>

            <header className="mb-10">
              <p className="text-sm font-medium text-ux-primary uppercase tracking-wide mb-3">
                Photo Studio
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                Remove the Spoon, Not the Fork
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-3">
                Why AI image editing needs controls, not better prompts
              </p>
              <p className="text-sm text-gray-400">15 September 2026</p>
            </header>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <p>
                A commercial food photographer recently described what AI had done to part of their
                job. They work on photography and video for food brands around the world
                (restaurants make up only a small part of their business) and said more clients were
                switching to AI for product and recipe imagery.
              </p>
              <p>
                Further down the same{' '}
                <a
                  href={SOURCES.reddit}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  r/foodphotography discussion
                </a>
                {', '}
                another photographer captured a very different cost of that transition:
                <Cite n={1} href={SOURCES.reddit} />
              </p>
              <blockquote className="border-l-4 border-gray-200 pl-5 italic text-gray-800">
                I&rsquo;d rather be taking actual photos and improving my skills, but instead I&rsquo;m
                expected to sit there for hours prompting a machine. &ldquo;Remove the extra spoon
                in the foreground.&rdquo; &ldquo;Remove the SPOON, not the fork.&rdquo; &ldquo;Put
                the fork back in.&rdquo;
              </blockquote>
              <p>
                Another product photographer in the thread put it more simply: AI editing was
                frustrating because it{' '}
                <strong className="text-gray-900">
                  &ldquo;looks worse and doesn&rsquo;t even save much time.&rdquo;
                </strong>
              </p>
              <p>
                That gets to the heart of a problem with generative image editing: the models can
                be remarkably capable, but the interface we often give people is still a blank text
                box.
              </p>
              <p>
                For creative exploration, that can be liberating. For precise commercial work, it
                can become exhausting.
              </p>
              <p>
                There&rsquo;s even a term emerging for this:{' '}
                <a
                  href={SOURCES.promptFatigue}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  prompt fatigue
                </a>
                {'. '}
                Google Cloud has used the phrase to describe the burden of repeatedly
                experimenting with instructions and examples to coax the right result from an AI
                system.
                <Cite n={2} href={SOURCES.promptFatigue} /> For commercial creative work, that
                fatigue becomes particularly obvious when a supposedly simple edit turns into a
                cycle of prompt, generate, inspect, correct and repeat.
              </p>
            </div>

            <QuoteCallout
              quote="Remove the SPOON, not the fork."
              context="A commercial photographer describing hours spent prompting a machine to make one precise edit."
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed overflow-hidden">
              <InlineImage
                src="/backgrounds/photographer-prompting-ai.png"
                alt="A chat prompt asking an image model to remove a spoon while leaving the fork unchanged"
                float="right"
                width={2848}
                height={1368}
              />

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                The prompt becomes another job
              </h2>
              <p>
                Google&rsquo;s own{' '}
                <a
                  href={SOURCES.gemini}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  guidance for Gemini image generation and editing
                </a>{' '}
                tells users to be{' '}
                <strong className="text-gray-900">&ldquo;hyper-specific&rdquo;</strong>, provide
                context and intent, iterate and refine, and use step-by-step instructions for more
                complex scenes.
                <Cite n={3} href={SOURCES.gemini} />
              </p>
              <p>Those are sensible recommendations. They are also a clue to the problem.</p>
              <p>
                If you simply want to make a food image warmer, remove a garnish, change the
                surface or create a cleaner social crop, you shouldn&rsquo;t need to become an
                expert in describing lighting, composition, camera position and everything that
                must <strong className="text-gray-900">not</strong> change.
              </p>
              <p>
                Natural language is flexible. That is one of its strengths, and one source of
                ambiguity.
              </p>
              <p>
                &ldquo;Remove the spoon&rdquo; sounds perfectly clear to a human. A generative
                model has to determine which spoon you mean, understand what surrounds it,
                reconstruct whatever was hidden behind it and preserve everything else that
                matters.
              </p>
              <p>Sometimes it does exactly that.</p>
              <p>Sometimes it removes the fork as well.</p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4 clear-right">
                Structure beats repeated negotiation
              </h2>
              <p>One way AI systems become easier to control is by introducing more structure.</p>
              <p>
                JSON is one familiar example. Instead of expressing everything as free-form prose,
                information can be represented as explicit fields and values. Google itself
                supports{' '}
                <a
                  href={SOURCES.structured}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  structured Gemini outputs using JSON Schema
                </a>
                {', '}
                allowing developers to constrain model responses to a predefined structure.
                <Cite n={4} href={SOURCES.structured} />
              </p>
              <p>
                That does <strong className="text-gray-900">not</strong> mean JSON is a magic image
                prompt, or that pasting JSON into a chatbot automatically produces better pictures.
              </p>
              <p>
                The useful idea is <strong className="text-gray-900">structure</strong>.
              </p>
              <p>
                For a food image, concepts such as lighting, surface, backdrop and subject can be
                treated as distinct attributes rather than repeatedly renegotiated through
                paragraphs of prose.
              </p>
              <p>
                Creators have already demonstrated{' '}
                <a
                  href={SOURCES.youtube}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  JSON-style workflows with Gemini image models
                </a>
                {'. '}
                GridMenu did not invent that idea. The opportunity is to turn principles like
                these into a useful product rather than another technique users have to learn.
                <Cite n={5} href={SOURCES.youtube} />
              </p>
            </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed overflow-hidden">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                The best prompt can be no prompt at all
              </h2>
              <InlineImage
                src="/backgrounds/food-photo-studio-controls.png"
                alt="GridMenu studio showing garnish, lighting, surface and camera controls beside a plated dish"
                float="left"
                width={2694}
                height={1656}
              />
              <p>
                <Link href="/" className="text-ux-primary hover:underline">
                  GridMenu
                </Link>{' '}
                starts with a real food photograph and gives the user controls for the changes they
                actually want to make: lighting, backdrop, surface, crop, angle, removals,
                garnishes and other presentation choices.
              </p>
              <p>
                Behind those controls, GridMenu translates intent into structured instructions for
                the image model.
              </p>
              <p>
                The user doesn&rsquo;t need to know the right prompt vocabulary. They don&rsquo;t
                need to understand JSON. And they shouldn&rsquo;t have to keep saying:
              </p>
              <p className="italic text-gray-800">Keep the dish the same.</p>
              <p className="italic text-gray-800">No, exactly the same.</p>
              <p className="italic text-gray-800">Put the fork back.</p>
              <p>
                The dish remains the source of truth. The aim is to change its presentation while
                constraining changes that were never requested.
              </p>
              <p>
                That does not make generative AI deterministic. Results can still vary, and there
                are edits a model simply cannot make reliably. But a purpose-built interface can
                reduce ambiguity before the model receives the request.
              </p>
            </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4 clear-left">
                Sometimes the AI needs to invent pixels
              </h2>
              <p>There is an important wrinkle: not all generated content is undesirable.</p>
              <p>
                If you remove an object from a photograph, something has to replace the pixels
                underneath it. In computer vision, this is generally called{' '}
                <strong className="text-gray-900">inpainting</strong>.{' '}
                <a
                  href={SOURCES.imagen}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ux-primary hover:underline"
                >
                  Google Research describes text-guided image inpainting
                </a>{' '}
                as making a localised edit to a selected region while keeping the result consistent
                with the source image.
                <Cite n={6} href={SOURCES.imagen} />
              </p>
              <p>
                Likewise, extending an image beyond its original frame requires the model to
                synthesise visual information the camera never captured, commonly called{' '}
                <strong className="text-gray-900">outpainting</strong> or generative expansion.
              </p>
              <p>That kind of invention can be useful. The important question is how much invention is acceptable.</p>
              <p>
                Removing a stray spoon and reconstructing a small area of tabletop is relatively
                constrained. Asking a model to turn an overhead photograph into an entirely
                front-facing scene may require it to invent large parts of the environment, table,
                plate and food that were never visible.
              </p>
              <p>So our principle is simple:</p>
            </div>

            <QuoteCallout
              quote="Generate where necessary. Preserve where possible."
              context="We would rather restrict an unreliable transformation than present an invented result as a faithful edit."
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                AI should remove work, not create a new profession
              </h2>
              <p>
                There is no shortage of pressure on companies to &ldquo;use AI&rdquo;. But adding
                AI to a workflow is not automatically an improvement.
              </p>
              <p>
                If a photographer, marketer or designer has to spend twenty minutes negotiating
                with a model to remove a spoon, prompt fatigue isn&rsquo;t a user problem - it is a
                workflow problem. The technology may be impressive while the experience is still
                poor.
              </p>
              <p>
                The more useful application of AI is often quieter: hide the complexity, narrow the
                choices to the ones that matter, preserve what the user already got right and make
                the result easier to repeat.
              </p>
              <p>That is the idea behind GridMenu.</p>
              <p className="font-bold text-gray-900">Control the image, not the prompt.</p>
            </div>

            <div className="mt-12 flex justify-center">
              <Link
                href="/"
                className="inline-block rounded-full bg-ux-primary px-8 py-3 text-sm font-semibold text-white hover:bg-ux-primary/90 transition-colors"
              >
                ← Back to GridMenu Home
              </Link>
            </div>

            <ShareButtons
              url="https://gridmenu.ai/blog/remove-the-spoon-not-the-fork"
              title="Remove the Spoon, Not the Fork"
            />

            <footer className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Sources
              </h3>
              <ol className="space-y-2 text-xs text-gray-500 list-decimal list-inside">
                <li>
                  <a
                    href={SOURCES.reddit}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Reddit, r/foodphotography: AI taking a huge cut out of my business
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.promptFatigue}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Google Cloud: Announcing Vertex AI Prompt Optimizer
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.gemini}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Google AI for Developers: Nano Banana image generation and editing
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.structured}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Google AI for Developers: Structured outputs
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.youtube}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    YouTube: example of a JSON-style Gemini image workflow
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCES.imagen}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-ux-primary transition-colors"
                  >
                    Google Research: Imagen Editor and EditBench
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
