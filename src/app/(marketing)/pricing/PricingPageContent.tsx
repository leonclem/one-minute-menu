'use client'

import { UXWrapper, UXCard, UXButton } from '@/components/ux'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfirmDialog } from '@/components/ui'
import BillingCurrencySelector from '@/components/BillingCurrencySelector'
import { PRICING_TIERS, formatPrice } from '@/lib/pricing-config'
import type { BillingCurrency } from '@/lib/currency-config'

export default function UXPricingPageContent({ 
  initialUser 
}: { 
  initialUser?: any 
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [user, setUser] = useState<any>(initialUser || null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutErrorTitle, setCheckoutErrorTitle] = useState<string>('Checkout Error')
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>('USD')

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const handleCurrencyChange = (currency: BillingCurrency) => {
    setSelectedCurrency(currency)
  }

  const pricingTiers = PRICING_TIERS.map(tier => ({
    ...tier,
    price: formatPrice(tier.prices[selectedCurrency], selectedCurrency),
    cta: tier.id === 'creator_pack' && !user ? 'Get Started Free' : tier.cta,
    tagline: tier.id === 'creator_pack' && !user ? tier.tagline : undefined,
    subtext: tier.id === 'creator_pack' && !user 
      ? 'Valid for 24 months. One free pack per signup.' 
      : tier.id === 'creator_pack' 
        ? 'Purchase additional menus and edit windows.'
        : tier.subtext,
  }))

  const faqs = [
    {
      q: 'Is there a free trial?',
      a: 'Yes. The first Creator Pack is free for every sign up. This allows you to create and export one fully customisable menu at no cost.'
    },
    {
      q: 'Does my Creator Pack ever expire?',
      a: 'Creator Packs are valid for 24 months from purchase. You can export and use your menu during this period.'
    },
    {
      q: 'Can I upgrade later?',
      a: 'Yes. You can purchase additional packs or subscribe to a monthly plan at any time. Your existing menus and credits are preserved and added to your new plan.'
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept major credit and debit cards. Additional payment methods may be available depending on your region.'
    },
    {
      q: 'Do you offer refunds?',
      a: 'Yes. If you are not satisfied, contact us within 30 days of your first purchase and we will review your request for a full refund. Note that excessive exports may void refund eligibility.'
    },
    {
      q: 'Is my data secure?',
      a: 'We use industry-standard security measures to protect your data. Data is processed in accordance with applicable data protection laws, and we only share data with trusted service providers necessary to operate the service.'
    },
    {
      q: 'Can I cancel my subscription?',
      a: 'Yes, Grid+ and Grid+Premium subscriptions are monthly and can be cancelled at any time through your dashboard.'
    }
  ]

  const handleCheckout = async (tierId: string) => {
    // If it's the free pack and user is not logged in, redirect to register
    if (tierId === 'creator_pack' && !user) {
      window.location.href = '/register?returnTo=/pricing'
      return
    }

    setLoading(tierId)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productType: tierId,
        }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else if (data.grantedFree) {
        window.location.href = '/dashboard?free_pack=granted'
      } else {
        console.error('Checkout error:', data.error)
        setCheckoutErrorTitle(data.code === 'REDUNDANT_PURCHASE' ? 'Purchase Not Required' : 'Checkout Error')
        setCheckoutError(data.error || 'Failed to initiate checkout')
      }
    } catch (error) {
      console.error('Checkout request failed:', error)
      setCheckoutErrorTitle('Unexpected Error')
      setCheckoutError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <UXWrapper>
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white text-hero-shadow mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-lg text-white/90 text-hero-shadow-strong max-w-2xl mx-auto mb-6">
          Choose the plan that fits your venue. Start free with your first Creator Pack.
        </p>
        
        {/* Currency Selector */}
        <div className="flex flex-col items-center gap-2">
          <label htmlFor="currency-selector" className="text-sm text-white/80 font-medium">
            Select your billing currency:
          </label>
          <BillingCurrencySelector
            userId={user?.id}
            onCurrencyChange={handleCurrencyChange}
          />
        </div>
      </div>

      <div className="container-ux">
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-12 pt-12">
          {pricingTiers.map((tier) => (
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
                <h3 id={`tier-${tier.id}-title`} className="text-2xl font-bold text-ux-text mb-1">{tier.name}</h3>
                {tier.tagline && (
                  <p className="text-ux-primary font-semibold text-sm mb-2">{tier.tagline}</p>
                )}
                <p className="text-gray-600 mb-4 text-sm min-h-[3rem]">{tier.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-ux-text">{tier.price}</span>
                  <span className="text-gray-500 text-sm block mt-1">{tier.period}</span>
                </div>
                
                <ul className="space-y-3 mb-8 text-left">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start text-gray-700 text-sm">
                      <svg className="w-5 h-5 text-ux-success mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
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
                  {tier.cta}
                </UXButton>
                
                {tier.subtext && (
                  <p className="text-[10px] text-gray-500 italic text-center leading-tight">{tier.subtext}</p>
                )}
              </div>
            </UXCard>
          ))}
        </div>

        {/* Fair Use Disclaimer */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-sm text-white/80 italic">
            *Fair-use limits apply to prevent abuse and ensure service quality. 
            Automated throttling may occur during peak periods.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="max-w-5xl mx-auto bg-white/10 backdrop-blur-md rounded-xl p-8 md:p-12 border border-white/20 shadow-2xl mb-16">
          <h3 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {faqs.map((faq, i) => (
              <div key={i} className="space-y-2">
                <h4 className="font-bold text-white text-lg">{faq.q}</h4>
                <p className="text-white/80 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
            <div className="md:col-span-2 pt-6 border-t border-white/10 text-center">
              <p className="text-white/90">
                Need help choosing? <a href="mailto:support@gridmenu.ai" className="text-ux-primary hover:underline font-bold">Contact us</a> for personalised recommendations.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        {!user && (
          <UXCard className="text-center mb-12 bg-gradient-to-br from-white to-gray-50">
            <h3 className="text-2xl font-bold text-ux-text mb-4">Ready to build your menu?</h3>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Join thousands of restaurants using GridMenu to create beautiful, photo-perfect menus.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/register">
                <UXButton variant="primary" size="lg" className="px-8">
                  Start for Free
                </UXButton>
              </a>
              <a href="/dashboard">
                <UXButton variant="outline" size="lg" className="px-8">
                  View Dashboard
                </UXButton>
              </a>
            </div>
          </UXCard>
        )}
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
