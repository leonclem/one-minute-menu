import type { Metadata } from 'next'
import { UXHeader, UXFooter, UXCard, UxFaqAccordion, UxStudioCtaBand } from '@/components/ux'
import { STUDIO_PUBLIC_FAQS } from '@/lib/studio/public-faqs'

export const metadata: Metadata = {
  title: 'Support | GridMenu',
  description:
    'Help with Photo Studio, credits, and account questions. Email support@gridmenu.ai.',
}

const faqs = STUDIO_PUBLIC_FAQS.map((faq) => ({
  question: faq.question,
  answer: <p>{faq.answer}</p>,
  aPlainText: faq.answer,
}))

const faqPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.aPlainText,
    },
  })),
}

export default function SupportPage() {
  return (
    <div className="ux-implementation ux-studio-surface relative flex min-h-dvh flex-col overflow-x-hidden md:min-h-screen">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
      />

      <UXHeader />

      <main className="container-ux w-full flex-1 py-10 md:py-14">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-white md:text-4xl">Support</h1>
          <p className="mt-2 text-white/60">We’re here to help</p>
        </div>

        <div className="mx-auto w-full max-w-5xl space-y-6">
          <UXCard>
            <h2 className="mb-2 text-lg font-bold text-white">Frequently Asked Questions</h2>
            <UxFaqAccordion faqs={faqs} variant="divided" />
          </UXCard>

          <UXCard>
            <h2 className="text-lg font-bold text-white">Still need help?</h2>
            <p className="mt-1 mb-4 text-sm text-white/60">
              Email us and we’ll get back to you as soon as we can.
            </p>
            <div className="rounded-[12px] border border-white/10 bg-black/25 p-4">
              <h3 className="font-semibold text-white">Email Support</h3>
              <p className="mt-1 mb-2 text-sm text-white/55">
                Get help with your account or technical issues
              </p>
              <a
                href="mailto:support@gridmenu.ai"
                className="text-sm font-semibold text-[var(--studio-link,#5fd3da)] hover:text-[#7fdee4]"
              >
                support@gridmenu.ai
              </a>
            </div>
          </UXCard>
        </div>

        <div className="mx-auto mt-8 w-full max-w-5xl md:mt-10">
          <UxStudioCtaBand
            primaryHref="/register"
            primaryLabel="Get started"
            subtitle="Sign up to start with 10 free credits, or email support@gridmenu.ai if you need help."
          />
        </div>
      </main>

      <UXFooter />
    </div>
  )
}
