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
          <div className="max-w-7xl mx-auto mb-5 text-sm text-white text-hero-shadow">
            <p className="font-semibold">
              {`Your Studio credits: ${creditBalance}`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-8 pt-2">
          {STUDIO_PRICING_TIERS.map((tier) => (
            <UXCard
              key={tier.id}
              className={`relative flex flex-col ${tier.recommended ? 'ring-2 ring-ux-primary shadow-xl scale-105 z-10' : ''} hover:shadow-lg transition-all duration-200`}
              role="article"
              aria-labelledby={`tier-${tier.id}-title`}
            >
              <div className="text-center flex-grow">
                {tier.recommended && (
                  <div className="mb-4 -mt-2">
                    <span className="inline-block bg-ux-primary text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                      Recommended
                    </span>
                  </div>
                )}
                <h2 id={`tier-${tier.id}-title`} className="text-2xl font-bold text-ux-text mb-1">
                  {tier.name}
                </h2>
                {tier.tagline && (
                  <p className="text-ux-primary-dark font-semibold text-sm mb-2">
                    {tier.tagline}
                  </p>
                )}
                <p className="text-gray-600 mb-4 text-sm min-h-[3rem]">{tier.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-ux-text">
                    {formatPrice(tier.prices[selectedCurrency], selectedCurrency)}
                  </span>
                  <span className="text-gray-500 text-sm block mt-1">{tier.period}</span>
                </div>
                <ul className="mb-8 text-left space-y-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-gray-700 text-sm">
                      <Play
                        className="mt-0.5 h-3 w-3 shrink-0 fill-ux-primary text-ux-primary"
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
                  className="w-full mb-3"
                  size="lg"
                  aria-label={`${tier.cta} for ${tier.name}`}
                  onClick={() => handleCheckout(tier.id)}
                  loading={loading === tier.id}
                >
                  {isLoggedIn ? tier.cta : 'Sign up to buy'}
                </UXButton>
                {tier.subtext && (
                  <p className="text-[10px] text-gray-500 italic text-center leading-tight">{tier.subtext}</p>
                )}
              </div>
            </UXCard>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1.5 mb-12">
          <label htmlFor="currency-selector" className="text-xs text-white/70 font-medium">
            Billing currency
          </label>
          <BillingCurrencySelector
            userId={(user as { id?: string } | null)?.id}
            onCurrencyChange={setSelectedCurrency}
            selectClassName="text-sm py-1.5 px-3"
          />
        </div>

        <div className="max-w-7xl mx-auto mb-16 bg-gradient-to-br from-ux-primary/30 to-ux-primary/40 rounded-md p-8 md:p-10 border border-ux-primary/40 shadow-xl text-white">
          <h2 className="text-xl font-bold text-white text-hero-shadow mb-4">How credits work</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/90 text-hero-shadow-strong text-sm leading-relaxed">
            {EXPLAINER.map((line) => (
              <li key={line}>{line}</li>
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
