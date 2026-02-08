import Link from 'next/link'
import type { ReactNode } from 'react'
import { UXHeader, UXFooter, UXCard, UXButton } from '@/components/ux'

const faqs: Array<{ q: string; a: ReactNode; aPlainText: string }> = [
  {
    q: 'What is GridMenu?',
    aPlainText:
      'GridMenu is a simple tool for creating professional restaurant menus quickly. It helps restaurants turn menu content—whether uploaded as a photo or entered manually—into clean, well-designed menus ready for print, QR codes, or digital sharing. It focuses purely on menu creation, without POS integrations or operational complexity.',
    a: (
      <div className="space-y-3">
        <p>
          GridMenu is a simple tool for creating professional restaurant menus quickly. It helps restaurants turn menu
          content—whether uploaded as a photo or entered manually—into clean, well-designed menus ready for print, QR
          codes, or digital sharing.
        </p>
        <p>It focuses purely on menu creation, without POS integrations or operational complexity.</p>
      </div>
    ),
  },
  {
    q: 'Who is GridMenu designed for?',
    aPlainText:
      'GridMenu is ideal for independent restaurants and cafés, bars and casual dining venues, pop-ups and new restaurant openings, and operators who want fast, affordable menu updates. It is not intended to replace full restaurant management platforms.',
    a: (
      <div className="space-y-3">
        <p>GridMenu is ideal for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Independent restaurants and cafés</li>
          <li>Bars and casual dining venues</li>
          <li>Pop-ups and new restaurant openings</li>
          <li>Operators who want fast, affordable menu updates</li>
        </ul>
        <p>It is not intended to replace full restaurant management platforms.</p>
      </div>
    ),
  },
  {
    q: 'Are the images on GridMenu AI-generated?',
    aPlainText:
      'Yes—AI-generated images are supported, but they’re optional. You can also upload and use your own photos, or provide reference images to guide the style and presentation. If you require fully bespoke food photography for branding purposes, GridMenu supports that workflow as well.',
    a: (
      <div className="space-y-3">
        <p>
          Yes—AI-generated images are supported, but they’re optional. You can also upload and use your own photos, or
          provide reference images to guide the style and presentation.
        </p>
        <p>
          If you require fully bespoke food photography for branding purposes, GridMenu supports that workflow as well.
        </p>
      </div>
    ),
  },
  {
    q: 'Will my menu look generic?',
    aPlainText:
      'No. GridMenu uses professionally designed menu templates to ensure clarity and visual balance, while allowing your content, imagery, and layout choices to define the final look. Templates exist to prevent poor design outcomes, not to limit creativity.',
    a: (
      <div className="space-y-3">
        <p>
          No. GridMenu uses professionally designed menu templates to ensure clarity and visual balance, while allowing
          your content, imagery, and layout choices to define the final look.
        </p>
        <p>Templates exist to prevent poor design outcomes, not to limit creativity.</p>
      </div>
    ),
  },
  {
    q: 'Can I just use AI tools like Gemini or ChatGPT to create a menu?',
    aPlainText:
      'You can, but GridMenu is built specifically for menu creation, not general AI output. General AI tools require prompt writing, repeated refinement, and manual design work. GridMenu removes this complexity by combining AI with structured layouts, design constraints, and automatic formatting to produce menus that are ready to use.',
    a: (
      <div className="space-y-3">
        <p>
          You can, but GridMenu is built specifically for menu creation, not general AI output. General AI tools require
          prompt writing, repeated refinement, and manual design work.
        </p>
        <p>
          GridMenu removes this complexity by combining AI with structured layouts, design constraints, and automatic
          formatting to produce menus that are ready to use.
        </p>
      </div>
    ),
  },
  {
    q: 'How do I create my first menu?',
    aPlainText:
      'After signing up, click “Create your first menu” and either upload a photo of your existing menu or start from scratch. GridMenu will guide you through structuring your content, choosing a layout, and generating a finished menu you can export immediately.',
    a: (
      <p>
        After signing up, click “Create your first menu” and either upload a photo of your existing menu or start from
        scratch. GridMenu will guide you through structuring your content, choosing a layout, and generating a finished
        menu you can export immediately.
      </p>
    ),
  },
  {
    q: 'Is GridMenu replacing designers or food photographers?',
    aPlainText:
      'No. GridMenu is designed for speed, flexibility, and everyday menu updates—such as seasonal changes, promotions, or new dishes. Many restaurants still work with designers or photographers for major brand projects. GridMenu simply removes the need to involve external suppliers for every update.',
    a: (
      <div className="space-y-3">
        <p>
          No. GridMenu is designed for speed, flexibility, and everyday menu updates—such as seasonal changes,
          promotions, or new dishes.
        </p>
        <p>
          Many restaurants still work with designers or photographers for major brand projects. GridMenu simply removes
          the need to involve external suppliers for every update.
        </p>
      </div>
    ),
  },
  {
    q: 'How fast can I create a menu with GridMenu?',
    aPlainText:
      'Most menus can be created in minutes. There is no need to schedule photography, brief designers, or wait for print proofs. Menus can be updated, regenerated, and exported instantly whenever your content changes.',
    a: (
      <div className="space-y-3">
        <p>Most menus can be created in minutes.</p>
        <p>
          There is no need to schedule photography, brief designers, or wait for print proofs. Menus can be updated,
          regenerated, and exported instantly whenever your content changes.
        </p>
      </div>
    ),
  },
  {
    q: 'What menu formats does GridMenu support?',
    aPlainText:
      'GridMenu supports print-ready PDF menus and high-resolution PNG menus. You can export your menu in multiple formats and regenerate it whenever updates are needed.',
    a: (
      <div className="space-y-3">
        <p>GridMenu supports:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Print-ready PDF menus</li>
          <li>High-resolution PNG menus</li>
        </ul>
        <p>You can export your menu in multiple formats and regenerate it whenever updates are needed.</p>
      </div>
    ),
  },
  {
    q: 'Does GridMenu integrate with POS or ordering systems?',
    aPlainText:
      'No. GridMenu is intentionally focused on menu creation only. It does not require POS integrations, staff training, or changes to how your restaurant operates. This keeps setup simple and avoids unnecessary complexity.',
    a: (
      <div className="space-y-3">
        <p>No.</p>
        <p>
          GridMenu is intentionally focused on menu creation only. It does not require POS integrations, staff training,
          or changes to how your restaurant operates.
        </p>
        <p>This keeps setup simple and avoids unnecessary complexity.</p>
      </div>
    ),
  },
  {
    q: 'Do I need design or technical skills to use GridMenu?',
    aPlainText:
      'No. GridMenu is designed to be intuitive and easy to use. If you can upload content and select a layout, you can create a professional menu. No design or technical experience is required.',
    a: (
      <div className="space-y-3">
        <p>No.</p>
        <p>
          GridMenu is designed to be intuitive and easy to use. If you can upload content and select a layout, you can
          create a professional menu.
        </p>
      </div>
    ),
  },
  {
    q: 'Is there a free plan?',
    aPlainText:
      'Yes. GridMenu offers a free plan that includes one menu with all core features, so you can try it properly before upgrading. Paid plans unlock additional menus and advanced features for ongoing use.',
    a: (
      <p>
        Yes. GridMenu offers a free plan that includes one menu with all core features, so you can try it properly
        before upgrading. Paid plans unlock additional menus and advanced features for ongoing use.
      </p>
    ),
  },
  {
    q: 'Can I change my billing currency after subscribing?',
    aPlainText:
      'Once you have an active subscription, the billing currency is locked for that subscription period to maintain consistent billing and accounting. If you need to change your billing currency, you would need to cancel your current subscription and create a new one with your preferred currency. Your subscription will remain active until the end of your current billing period. If you need assistance with this process, please contact us at support@gridmenu.ai and we can help guide you through the transition.',
    a: (
      <div className="space-y-3">
        <p>
          Once you have an active subscription, the billing currency is locked for that subscription period to maintain
          consistent billing and accounting.
        </p>
        <p>
          If you need to change your billing currency, you would need to cancel your current subscription and create a
          new one with your preferred currency. Your subscription will remain active until the end of your current
          billing period.
        </p>
        <p>
          If you need assistance with this process, please contact us at{' '}
          <a href="mailto:support@gridmenu.ai" className="text-ux-primary hover:opacity-90 font-medium">
            support@gridmenu.ai
          </a>{' '}
          and we can help guide you through the transition.
        </p>
      </div>
    ),
  },
]

/** FAQPage schema for SEO (schema.org). Generated from the same FAQ data as the visible list. */
const faqPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.aPlainText,
    },
  })),
}

export default function SupportPage() {
  return (
    <div className="ux-implementation min-h-dvh md:min-h-screen flex flex-col flex-grow overflow-x-hidden relative">
      {/* FAQPage schema for SEO (rich results in search) */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
      />
      {/* Background image fixed to viewport so tall UX pages scroll over it without stretching */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%',
        }}
      />

      <UXHeader />

      <main className="container-ux w-full py-10 md:py-12 flex-1">
        {/* Hero heading */}
        <div className="text-center mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white text-hero-shadow">Support</h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">We’re here to help</p>
        </div>

        <div className="space-y-6 w-full max-w-5xl mx-auto">
          {/* FAQ */}
          <UXCard>
            <div className="relative z-10">
              <h3 className="text-lg font-semibold text-ux-text mb-4">Frequently Asked Questions</h3>
              <div className="space-y-2">
                {faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group rounded-md border border-ux-border bg-white/70 px-4 py-3"
                  >
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                      <span className="font-medium text-ux-text">{faq.q}</span>
                      <span
                        aria-hidden
                        className="mt-0.5 text-ux-text-secondary transition-transform duration-200 group-open:rotate-180"
                      >
                        ▾
                      </span>
                    </summary>
                    <div className="mt-2 text-sm text-ux-text-secondary leading-relaxed">{faq.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </UXCard>

          {/* Contact Options (below FAQs to encourage self-help first) */}
          <UXCard>
            <div className="relative z-10">
              <h3 className="text-lg font-semibold text-ux-text mb-1">Still need help?</h3>
              <p className="text-sm text-ux-text-secondary mb-4">Email us and we’ll get back to you as soon as we can.</p>
              <div className="space-y-4">
                <div className="rounded-md border border-ux-border p-4 bg-white/70">
                  <h4 className="font-medium text-ux-text mb-2">Email Support</h4>
                  <p className="text-sm text-ux-text-secondary mb-2">
                    Get help with your account or technical issues
                  </p>
                  <a
                    href="mailto:support@gridmenu.ai"
                    className="text-ux-primary hover:opacity-90 text-sm font-medium"
                  >
                    support@gridmenu.ai
                  </a>
                </div>
              </div>
            </div>
          </UXCard>
        </div>

        {/* Getting Started CTA */}
        <div className="mt-6 md:mt-8 w-full max-w-5xl mx-auto text-center bg-gradient-to-br from-ux-primary/30 to-ux-primary/40 rounded-md p-8 border border-ux-primary/40 shadow-xl text-white">
          <h3 className="text-xl font-bold text-white text-hero-shadow mb-2">Ready to Get Started?</h3>
          <p className="text-white/90 text-hero-shadow-strong mb-6 max-w-lg mx-auto">
            Create your digital menu in under 5 minutes with our simple setup process.
          </p>
          <Link href="/register">
            <UXButton variant="primary" size="lg" className="px-8 shadow-lg">
              Create Your Menu
            </UXButton>
          </Link>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center text-sm rounded-full bg-white/20 border border-white/40 text-white hover:bg-white/30 px-4 py-2 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      <UXFooter />
    </div>
  )
}
