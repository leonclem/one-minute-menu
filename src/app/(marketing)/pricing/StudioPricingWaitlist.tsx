'use client'

import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { UXWrapper, UXCard, UXButton } from '@/components/ux'
import { ConfirmDialog } from '@/components/ui'
import BillingCurrencySelector from '@/components/BillingCurrencySelector'
import { supabase } from '@/lib/supabase'
import { STUDIO_PRICING_TIERS, formatPrice } from '@/lib/pricing-config'
import { STUDIO_PRICING_SEO } from '@/lib/studio/public-seo'
import type { BillingCurrency } from '@/lib/currency-config'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'

const EXPLAINER = [
  'New accounts start with 10 free credits.',
  '1 credit = 1 standard AI photo generation.',
  'Pro generations use 2 credits.',
  'Downloads and simple crop/resize exports are included.',
  'AI expand and cut-out use 1 credit.',
  'Credits are only used when GridMenu creates or transforms an image.',
  'Paid credits are valid for 12 months from purchase.',
] as const

export default function StudioPricingWaitlist({
  initialUser,
  initialCreditBalance = null,
}: {
  initialUser?: unknown
  initialCreditBalance?: number | null
}) {
  const [user, setUser] = useState<unknown>(initialUser || null)
  const [loading, setLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutErrorTitle, setCheckoutErrorTitle] = useState<string>('Checkout Error')
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>('USD')

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const isLoggedIn = !!user
  const creditBalance = initialCreditBalance ?? 0

  const handleCheckout = async (tierId: string) => {
    if (!user) {
      window.location.href = '/register?returnTo=/pricing'
      return
    }

    captureEvent(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
      plan: tierId,
      location: 'pricing_page',
    })

    setLoading(tierId)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: tierId,
          billingCurrency: selectedCurrency,
        }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        const title =
          data.code === 'ACCOUNT_PENDING'
            ? 'Account pending approval'
            : data.code === 'ACCOUNT_REQUIRED'
              ? 'Sign in required'
              : 'Checkout Error'
        setCheckoutErrorTitle(title)
        setCheckoutError(data.error || 'Failed to initiate checkout')
      }
    } catch {
      setCheckoutErrorTitle('Unexpected Error')
      setCheckoutError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <UXWrapper>
      <h1 className="sr-only">{STUDIO_PRICING_SEO.h1}</h1>

      <div className="container-ux">
        {isLoggedIn && (
          <div className="mx-auto mb-6 max-w-7xl text-sm text-white/80">
            <p>
              Your Studio credits:{' '}
              <span className="font-bold text-[var(--studio-amber,#f8bc02)]">{creditBalance}</span>
            </p>
          </div>
        )}

        <div className="mx-auto mb-10 grid max-w-7xl grid-cols-1 gap-6 pt-4 md:grid-cols-3 md:gap-5 lg:gap-8">
          {STUDIO_PRICING_TIERS.map((tier) => (
            <UXCard
              key={tier.id}
              className={`relative flex flex-col overflow-visible ${
                tier.recommended
                  ? 'z-10 border-2 border-[var(--studio-teal,#01b3bf)]'
                  : ''
              }`}
              role="article"
              aria-labelledby={`tier-${tier.id}-title`}
            >
              {tier.recommended && (
                <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--studio-teal,#01b3bf)] px-3 py-1 text-xs font-bold text-[#03272a]">
                  Recommended
                </span>
              )}
              <div className={`flex-grow text-center ${tier.recommended ? 'pt-3' : ''}`}>
                <h2 id={`tier-${tier.id}-title`} className="text-2xl font-bold text-white">
                  {tier.name}
                </h2>
                {tier.tagline && (
                  <p className="mt-1 text-sm font-semibold text-[var(--studio-teal,#01b3bf)]">
                    {tier.tagline}
                  </p>
                )}
                <div className="mb-6 mt-5">
                  <span className="text-4xl font-extrabold tracking-[-0.03em] text-white">
                    {formatPrice(tier.prices[selectedCurrency], selectedCurrency)}
                  </span>
                  <span className="mt-1 block text-sm text-white/45">{tier.period}</span>
                </div>
                <ul className="mb-8 space-y-2.5 text-left">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
                      <Play
                        className="mt-0.5 h-3 w-3 shrink-0 fill-[var(--studio-teal,#01b3bf)] text-[var(--studio-teal,#01b3bf)]"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto">
                <UXButton
                  variant={tier.recommended ? 'primary' : 'outline'}
                  className="mb-3 w-full"
                  size="lg"
                  noShadow
                  aria-label={`${tier.cta} for ${tier.name}`}
                  onClick={() => handleCheckout(tier.id)}
                  loading={loading === tier.id}
                >
                  {isLoggedIn ? tier.cta : 'Sign up to buy'}
                </UXButton>
                {tier.subtext && (
                  <p className="text-center text-[10px] leading-tight text-white/40">
                    {tier.subtext}
                  </p>
                )}
              </div>
            </UXCard>
          ))}
        </div>

        <div className="mb-12 flex flex-col items-center gap-1.5">
          <label
            htmlFor="currency-selector"
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45"
          >
            Billing currency
          </label>
          <BillingCurrencySelector
            userId={(user as { id?: string } | null)?.id}
            onCurrencyChange={setSelectedCurrency}
            selectClassName="text-sm py-1.5 px-3 rounded-[9px]"
          />
        </div>

        <div className="card-ux mx-auto mb-16 max-w-7xl p-8 md:p-10">
          <h2 className="mb-4 text-xl font-bold text-white">How credits work</h2>
          <ul className="space-y-2.5 text-sm leading-relaxed text-white/65">
            {EXPLAINER.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--studio-teal,#01b3bf)]"
                  aria-hidden="true"
                />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={!!checkoutError}
        title={checkoutErrorTitle}
        description={checkoutError || ''}
        confirmText="Got it"
        onConfirm={() => setCheckoutError(null)}
        onCancel={() => setCheckoutError(null)}
      />
    </UXWrapper>
  )
}
