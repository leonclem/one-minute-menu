'use client'

import Link from 'next/link'
import { UXButton } from './UXButton'

export function UxStudioCtaBand({
  primaryHref,
  primaryLabel,
  onPrimaryClick,
  subtitle = 'Sign up and start with 10 free credits. Buy more anytime on the pricing page.',
}: {
  primaryHref: string
  primaryLabel: string
  onPrimaryClick?: () => void
  subtitle?: string
}) {
  return (
    <section className="ux-cta-band mx-auto w-full max-w-5xl px-6 py-10 text-center sm:px-10 sm:py-12">
      <h2 className="text-2xl font-bold tracking-[-0.02em] text-white md:text-3xl">
        Ready to try Photo Studio?
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[0.95rem] leading-relaxed text-white/60">
        {subtitle}
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
        <Link href={primaryHref} className="w-full sm:w-auto" onClick={onPrimaryClick}>
          <UXButton variant="primary" size="lg" noShadow className="w-full min-w-[200px] sm:w-auto">
            {primaryLabel}
          </UXButton>
        </Link>
        <Link href="/pricing" className="w-full sm:w-auto">
          <UXButton variant="outline" size="lg" noShadow className="w-full min-w-[200px] sm:w-auto">
            See pricing
          </UXButton>
        </Link>
      </div>
    </section>
  )
}
