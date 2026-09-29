import Image from 'next/image'
import Link from 'next/link'
import { UxFaqAccordion } from '@/components/ux'
import {
  AI_FOOD_PHOTOGRAPHY_FAQS,
  BEFORE_AFTER_EXAMPLES,
  OUTPUT_FORMATS,
  USE_CASES,
} from './copy'
import {
  AI_FOOD_PHOTOGRAPHY_PRIMARY_LABEL,
  AI_FOOD_PHOTOGRAPHY_STUDIO_HREF,
  trackAiFoodPhotographyCta,
} from './tracking'

export function AiFoodPhotographyLower() {
  return (
    <>
      <section>
        <div className="container-ux py-16 md:py-20">
          <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">Built for people who work with food imagery</h2>
          <p className="mt-4 max-w-2xl text-[17px] text-white/75">GridMenu can support a range of food photography workflows.</p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((item) => (
              <li key={item.title}>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-white/70">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0f1c1f]">
        <div className="container-ux py-16 md:py-20">
          <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">See what changes, and what stays the same</h2>
          <p className="mt-4 max-w-2xl text-white/70">
            These pairs reuse the same dishes shown on the GridMenu homepage. The food stays recognisable. The presentation changes.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {BEFORE_AFTER_EXAMPLES.map((example) => (
              <figure key={`${example.caption}-${example.afterSrc}`} className="overflow-hidden rounded-2xl bg-black/25">
                <div className="grid grid-cols-2">
                  <div className="relative aspect-square">
                    <Image src={example.beforeSrc} alt={example.beforeAlt} fill sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw" className="object-cover" />
                    <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Before</span>
                  </div>
                  <div className="relative aspect-square">
                    <Image src={example.afterSrc} alt={example.afterAlt} fill sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw" className="object-cover" />
                    <span className="absolute left-2 top-2 rounded bg-[#01B3BF] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#04232a]">After</span>
                  </div>
                </div>
                <figcaption className="px-4 py-3 text-sm text-white/80">{example.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="container-ux py-16 md:py-20">
          <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.02em] md:text-4xl">Designed specifically for food photography</h2>
          <div className="mt-6 max-w-3xl space-y-4 text-[17px] leading-relaxed text-white/75">
            <p>General-purpose AI image tools can produce impressive results, but food imagery introduces a specific problem: the dish often needs to remain recognisable.</p>
            <p>GridMenu is designed around that constraint.</p>
            <p>Rather than treating each edit as a new image-generation task, GridMenu focuses on controlled changes to the presentation of an existing food photo.</p>
          </div>
          <ul className="mt-8 max-w-3xl list-disc space-y-2 pl-5 text-white/80">
            <li>Real food photo as the starting point</li>
            <li>No prompt engineering required</li>
            <li>Food-specific controls</li>
            <li>A consistent editing workflow</li>
            <li>Suitable for repeated content production</li>
            <li>Multiple output formats</li>
            <li>Designed around preserving the dish</li>
          </ul>
          <p className="mt-6 max-w-3xl text-sm text-white/60">
            Why invented dishes fail in practice:{' '}
            <Link href="/blog/the-problem-with-ai-imagery" className="font-semibold text-[#5fd3da] hover:text-[#7fdee4]">
              The problem with AI imagery
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0f1c1f]">
        <div className="container-ux py-16 md:py-20">
          <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">Create food imagery for the channels you actually use</h2>
          <p className="mt-4 max-w-2xl text-[17px] text-white/75">
            One source photo can become multiple assets without repeating the entire photography process.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OUTPUT_FORMATS.map((format) => (
              <li key={format.label}>
                <p className="font-bold">{format.label}</p>
                <p className="mt-1 text-sm text-white/65">{format.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-white/60">
            Credit packs for extra generations are on the{' '}
            <Link href="/pricing" className="font-semibold text-[#5fd3da] hover:text-[#7fdee4]">
              pricing page
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="container-ux max-w-3xl py-16 text-center md:py-20">
          <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">See what GridMenu can do with your food photo</h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/75">
            Upload a real food image and create a studio-quality version using simple, controlled editing options.
          </p>
          <p className="mt-3 text-white/75">No prompt engineering required.</p>
          <Link
            href={AI_FOOD_PHOTOGRAPHY_STUDIO_HREF}
            onClick={() =>
              trackAiFoodPhotographyCta('closing', AI_FOOD_PHOTOGRAPHY_PRIMARY_LABEL, AI_FOOD_PHOTOGRAPHY_STUDIO_HREF)
            }
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-[#00b3bf] px-7 py-4 text-[16px] font-bold text-[#04232a] shadow-[0_0_26px_rgba(0,179,191,0.45)] transition hover:brightness-110"
          >
            {AI_FOOD_PHOTOGRAPHY_PRIMARY_LABEL}
          </Link>
          <p className="mt-4 text-sm text-white/55">Start with free credits. No professional photography setup required.</p>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0f1c1f]">
        <div className="container-ux mx-auto max-w-3xl py-16 md:py-20">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-[-0.02em] md:text-4xl">Common questions</h2>
          <UxFaqAccordion faqs={AI_FOOD_PHOTOGRAPHY_FAQS} />
        </div>
      </section>
    </>
  )
}
