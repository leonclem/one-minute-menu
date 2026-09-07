import type { ReactNode } from 'react'

export type UxFaqItem = {
  question: string
  answer: ReactNode
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UxFaqAccordion({
  faqs,
  variant = 'bars',
}: {
  faqs: UxFaqItem[]
  variant?: 'bars' | 'divided'
}) {
  return (
    <div className={variant === 'divided' ? 'ux-faq-divided' : 'space-y-2'}>
      {faqs.map((faq) => (
        <details
          key={faq.question}
          className={variant === 'divided' ? 'ux-faq-row group' : 'ux-faq-bar group'}
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
            <span className="font-medium text-white">{faq.question}</span>
            <Chevron className="mt-0.5 shrink-0 text-white/45 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="mt-2 text-sm leading-relaxed text-white/60">{faq.answer}</div>
        </details>
      ))}
    </div>
  )
}
