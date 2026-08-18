import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { UXHeader, UXFooter, UXCard, UXButton } from '@/components/ux'
import { STUDIO_PUBLIC_FAQS } from '@/lib/studio/public-faqs'

export const metadata: Metadata = {
  title: 'Support | GridMenu',
  description:
    'Help with Photo Studio, credits, and account questions. Email support@gridmenu.ai.',
}

const faqs: Array<{ q: string; a: ReactNode; aPlainText: string }> = STUDIO_PUBLIC_FAQS.map(
  (faq) => ({
    q: faq.question,
    a: <p>{faq.answer}</p>,
    aPlainText: faq.answer,
  }),
)

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
          <h3 className="text-xl font-bold text-white text-hero-shadow mb-2">
            Ready to try Photo Studio?
          </h3>
          <p className="text-white/90 text-hero-shadow-strong mb-6 max-w-lg mx-auto">
            Sign up to start with 10 free credits, or email support@gridmenu.ai if you need help.
          </p>
          <Link href="/register">
            <UXButton variant="primary" size="lg" className="px-8 shadow-lg">
              Create your account
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
