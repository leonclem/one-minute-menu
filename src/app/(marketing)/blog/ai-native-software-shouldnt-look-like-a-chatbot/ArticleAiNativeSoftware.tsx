'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UXWrapper } from '@/components/ux'
import { ArticleAuthor, articleAuthorJsonLd } from '../ArticleAuthor'

const ARTICLE_TITLE = "AI-Native Software Shouldn't Look Like a Chatbot"
const ARTICLE_URL = 'https://gridmenu.ai/blog/ai-native-software-shouldnt-look-like-a-chatbot'

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: ARTICLE_TITLE,
  description:
    'When teams keep rewriting the same AI prompt, the interface should change. AI-native software hides that prompt behind controls the user already understands.',
  datePublished: '2026-10-06',
  author: articleAuthorJsonLd,
  publisher: {
    '@type': 'Organization',
    name: 'GridMenu',
    url: 'https://gridmenu.ai',
    logo: {
      '@type': 'ImageObject',
      url: 'https://gridmenu.ai/logos/social-1200x630.png',
    },
  },
  image: 'https://gridmenu.ai/backgrounds/ai-native-software-shouldnt-look-like-a-chatbot.jpg',
  url: ARTICLE_URL,
}

const SOURCES = {
  nngChat: 'https://www.nngroup.com/articles/ai-chat-not-the-answer/',
  nngControls: 'https://www.nngroup.com/articles/genui-buttons-and-checkboxes/',
  nngSiteChat: 'https://www.nngroup.com/articles/site-ai-chatbot/',
  microsoft:
    'https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/',
  mckinsey:
    'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-how-organizations-are-rewiring-to-capture-value',
  gartner: 'https://www.gartner.com/en/articles/genai-project-failure',
  andrewNg: 'https://www.gsb.stanford.edu/insights/andrew-ng-why-ai-new-electricity',
}

function Slot({ children }: { children: string }) {
  return <span className="not-italic font-semibold text-gray-900">[{children}]</span>
}

function QuoteCallout({ quote, context }: { quote: string; context: string }) {
  return (
    <aside
      className="my-10 rounded-2xl border-l-4 border-ux-primary px-7 py-6"
      style={{
        background: 'linear-gradient(to right, rgba(1,179,191,0.12), rgba(1,179,191,0.03))',
      }}
    >
      <p className="text-2xl sm:text-3xl font-extrabold text-ux-primary leading-snug mb-2">{quote}</p>
      <p className="text-base text-gray-700 leading-relaxed">{context}</p>
    </aside>
  )
}

function ShareButtons({ url, title }: { url: string; title: string }) {
  const encoded = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  return (
    <div className="flex items-center gap-3 mt-10 pt-8 border-t border-gray-200">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 mr-1">Share</span>
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

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-ux-primary hover:underline">
      {children}
    </a>
  )
}

export default function ArticleAiNativeSoftware() {
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
            <div className="mb-10 overflow-hidden rounded-lg">
              <Image
                src="/backgrounds/ai-native-software-shouldnt-look-like-a-chatbot.jpg"
                alt="A chat thread of image-edit requests beside GridMenu controls for lighting, surface, and plate on a photo of baked salmon"
                width={1264}
                height={671}
                className="h-auto w-full"
                priority
              />
            </div>

            <header className="mb-10">
              <p className="text-sm font-medium text-ux-primary uppercase tracking-wide mb-3">
                Photo Studio
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                {ARTICLE_TITLE}
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-3">
                We still ask each other, &ldquo;What do you use AI for?&rdquo; One day that might
                sound as strange as asking, &ldquo;What do you use electricity for?&rdquo;
              </p>
              <p className="text-sm text-gray-400">6 October 2026</p>
              <ArticleAuthor variant="byline" />
            </header>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <p>At conferences, in offices, over lunch, a question comes up constantly:</p>
              <p className="font-bold text-gray-900">&ldquo;So, what do you use AI for?&rdquo;</p>
              <p>Writing. Research. Coding. Images. Meeting notes. Presentations.</p>
              <p>
                It makes sense. For many people, generative AI arrived through a chat window.
                ChatGPT, Copilot and similar tools made extraordinary capability accessible through
                one simple interaction: type what you want and see what happens.
              </p>
              <p>
                But we may be starting to confuse the interface that introduced us to AI with the
                interface AI software should ultimately have.
              </p>
            </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                When prompts repeat, the interface should probably change
              </h2>
              <p>
                We recently wrote about{' '}
                <Link
                  href="/blog/remove-the-spoon-not-the-fork"
                  className="font-semibold text-ux-primary hover:underline"
                >
                  prompt fatigue
                </Link>{' '}
                in AI image editing: repeatedly explaining what should change, what should stay
                untouched, and what the model accidentally changed last time.
              </p>
              <p>
                That becomes more important as AI moves from experimentation into repeatable
                business workflows.
              </p>
              <p>If a marketer, in creating or editing a photo, keeps writing variations of:</p>
              <blockquote className="border-l-4 border-gray-200 pl-5 italic text-gray-800">
                Make the lighting softer, use a warm wooden surface, keep the product unchanged,
                remove the distracting object and crop it for Instagram.
              </blockquote>
              <p>
                then the intent is no longer particularly mysterious. The task already has
                structure. Only the values are changing, all of which could be wired to controls, not just text:</p>
              <blockquote className="border-l-4 border-gray-200 pl-5 italic text-gray-800">
                Make the <Slot>lighting</Slot> <Slot>softer</Slot>, use <Slot>a warm wooden surface</Slot>,
                keep the product unchanged, remove <Slot>the distracting object</Slot> and crop it
                for <Slot>Instagram</Slot>.
              </blockquote>
            </div>

            <QuoteCallout
              quote="If users keep typing variations of the same prompt, there may be a better interface hiding inside the chat box."
              context="Lighting can be a control. Surface can be a choice. Crop can be a button. Things that must remain unchanged can be explicit."
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <p>
                The application can still translate those selections into detailed model
                instructions behind the scenes. The user should not have to manage that complexity.
              </p>
              <p>
                Nielsen Norman Group has made a similar case from the UX side. Its research argues
                that{' '}
                <ExternalLink href={SOURCES.nngChat}>AI chat is not always the answer</ExternalLink>{' '}
                and warns against reaching for conversational AI before asking whether another
                interaction would serve users better.
                <Cite n={1} href={SOURCES.nngChat} /> More recent NN/g work on{' '}
                <ExternalLink href={SOURCES.nngControls}>
                  buttons and checkboxes in generative interfaces
                </ExternalLink>{' '}
                shows how controls can reduce typing and memory burden while helping users provide
                useful context.
                <Cite n={2} href={SOURCES.nngControls} />
              </p>
            </div>

            <figure className="my-10">
              <Image
                src="/backgrounds/prompt-is-an-implementation-detail.png"
                alt="A diagram from a person's intent, through visible controls and a faded instruction layer, to a model and a finished image"
                width={1672}
                height={466}
                className="h-auto w-full rounded-lg"
              />
              <figcaption className="mt-3 text-sm text-gray-500 leading-relaxed">
                The model can still receive a complex prompt. The user doesn&rsquo;t have to write
                it.
              </figcaption>
            </figure>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Use chat where you would actually chat
              </h2>
              <p>None of this means chat is a bad interface.</p>
              <p>
                Conversation is useful when the conversation itself adds value: troubleshooting an
                unfamiliar problem, exploring an idea, asking follow-up questions, getting support,
                or working through something where the destination is not yet clear.
              </p>
              <p>
                But a prompt box should not become the fallback because a product has not yet
                worked out how to translate common user intent into an interface.
              </p>
              <p>Even something apparently open-ended like:</p>
              <blockquote className="border-l-4 border-gray-200 pl-5 italic text-gray-800">
                Make this feel more like a summer campaign for a premium Mediterranean brand.
              </blockquote>
              <p>
                might become chat-less if it is a common workflow. Season, mood, market, brand
                positioning and visual references can all become understandable choices when those
                decisions repeat often enough.
              </p>
              <p>
                Microsoft Research&rsquo;s{' '}
                <ExternalLink href={SOURCES.microsoft}>
                  Guidelines for Human-AI Interaction
                </ExternalLink>{' '}
                emphasise efficient invocation, efficient correction, contextually relevant
                information and user control.
                <Cite n={3} href={SOURCES.microsoft} /> Those are interface problems, not
                prompt-engineering problems.
              </p>
            </div>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                The &ldquo;Ask AI&rdquo; button can be an organisational shortcut
              </h2>
              <p>
                There is another reason chat boxes appear everywhere: they are comparatively easy
                to add to an existing product.
              </p>
              <p>
                The temptation is understandable. Software providers are under pressure to demonstrate
                an AI strategy, while redesigning an established workflow around AI is much harder than
                adding an &ldquo;Ask AI&rdquo; panel.
              </p>
              <p>But the evidence points towards workflow design as the more valuable work.</p>
              <p>
                In its 2025 global AI survey,{' '}
                <ExternalLink href={SOURCES.mckinsey}>McKinsey found</ExternalLink> that workflow
                redesign had the largest effect, among the organisational attributes it tested, on
                whether companies reported EBIT impact from generative AI. Yet only 21% of
                respondents whose organisations used GenAI said they had fundamentally redesigned
                at least some workflows.
                <Cite n={4} href={SOURCES.mckinsey} />
              </p>
              <p>
                <ExternalLink href={SOURCES.gartner}>Gartner reported in 2026</ExternalLink> that at
                least half of GenAI projects had been abandoned after proof of concept by the end
                of 2025, citing unclear business value, poor data quality, inadequate controls and
                escalating costs among the reasons.
                <Cite n={5} href={SOURCES.gartner} />
              </p>
              <p>Adding AI is relatively easy.</p>
              <p>
                Working out how the product should behave differently because AI exists is much
                harder.
              </p>
            </div>

            <figure className="my-10">
              <Image
                src="/backgrounds/bolted-on-ai-versus-built-in-workflow.png"
                alt="A product screen with a floating Ask AI chat beside the same kind of screen with suggestions built into the workflow"
                width={1672}
                height={941}
                className="h-auto w-full rounded-lg"
              />
              <figcaption className="mt-3 text-sm text-gray-500 leading-relaxed">
                Adding AI to a product is not the same as redesigning the workflow around AI.
              </figcaption>
            </figure>

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Electricity disappeared into appliances
              </h2>
              <p>There is an analogy about AI that has stuck with me.</p>
              <p>
                In 2017, Andrew Ng famously described{' '}
                <ExternalLink href={SOURCES.andrewNg}>
                  AI as &ldquo;the new electricity&rdquo;
                </ExternalLink>, arguing that electricity transformed industry after industry and AI would do
                something similar.
                <Cite n={6} href={SOURCES.andrewNg} />
              </p>
              <p>The analogy becomes even more interesting when you think about the interface.</p>
              <p>Most of us do not wake up thinking:</p>
              <p className="font-bold text-gray-900">
                &ldquo;I&rsquo;d like to use some electricity today.&rdquo;
              </p>
              <p>We make coffee. Turn on the lights. Take a lift. Open a laptop.</p>
              <p>
                If someone at a conference asked, &ldquo;What do you use electricity for?&rdquo;,
                the question would sound strange because electricity has disappeared into thousands
                of products and behaviours.
              </p>
              <p>AI may be heading in the same direction.</p>
              <p>
                Today we still talk about &ldquo;using AI&rdquo; because the technology is new
                enough to remain visible. We open an AI product, enter a prompt and watch the AI
                respond.
              </p>
              <p>Mature technology tends to recede into the experience.</p>
              <p>
                For{' '}
                <Link href="/" className="font-semibold text-ux-primary hover:underline">
                  GridMenu
                </Link>, that means someone should be able to change the presentation of a real food
                photograph by choosing what they want, rather than learning how to describe that
                choice to a model.
              </p>
              <p>The model still matters. The prompts still matter. The AI still does the work.</p>
              <p>They just do not necessarily need to be the interface.</p>
              <p>
                Perhaps one sign that AI-native software has matured will be that users stop
                noticing the AI at all.
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

            <ArticleAuthor variant="contact" />

            <ShareButtons url={ARTICLE_URL} title={ARTICLE_TITLE} />

            <footer className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Sources
              </h3>
              <ol className="space-y-2 text-xs text-gray-500 list-decimal list-inside">
                <li>
                  <ExternalLink href={SOURCES.nngChat}>
                    Nielsen Norman Group: AI Chat Is Not (Always) the Answer
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={SOURCES.nngControls}>
                    Nielsen Norman Group: The Most Exciting Development in GenUI: Buttons and
                    Checkboxes
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={SOURCES.microsoft}>
                    Microsoft Research: Guidelines for Human-AI Interaction Design
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={SOURCES.mckinsey}>
                    McKinsey: The State of AI: How Organizations Are Rewiring to Capture Value
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={SOURCES.gartner}>
                    Gartner: Why 50% of GenAI Projects Fail and How to Beat the Odds
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={SOURCES.andrewNg}>
                    Stanford Graduate School of Business: Andrew Ng: Why AI Is the New Electricity
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={SOURCES.nngSiteChat}>
                    Nielsen Norman Group: What Is Your Site&rsquo;s AI Chatbot for? Users
                    Can&rsquo;t Tell
                  </ExternalLink>
                </li>
              </ol>
            </footer>
          </div>
        </article>
      </div>
    </UXWrapper>
  )
}
