import { UXWrapper, UXSection, UXCard, UXButton } from '@/components/ux'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing Plans | GridMenu',
  description: 'Choose the perfect plan for your restaurant. Create mobile-friendly QR code menus with our affordable pricing plans. Start with a free trial - no credit card required.',
  keywords: ['QR menu pricing', 'restaurant menu pricing', 'digital menu cost', 'QR code menu plans'],
  openGraph: {
    title: 'Pricing Plans | GridMenu',
    description: 'Choose the perfect plan for your restaurant. Start with a free trial - no credit card required.',
    type: 'website',
  },
}

export default function UXPricingPage() {
  const pricingTiers = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$9',
      period: '/month',
      description: 'Perfect for small restaurants getting started',
      features: [
        'Up to 3 menus',
        'Basic templates',
        'QR code generation',
        'PDF & Image exports',
        'Email support',
        'Mobile-responsive menus'
      ],
      cta: 'Start Free Trial'
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '$29',
      period: '/month',
      recommended: true,
      description: 'Best for growing restaurants with multiple locations',
      features: [
        'Unlimited menus',
        'Premium templates',
        'Custom branding',
        'Analytics dashboard',
        'Priority support',
        'QR code customization',
        'Instant price updates',
        'HTML export with hosting'
      ],
      cta: 'Start Free Trial'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      period: '/month',
      description: 'For restaurant chains and franchises',
      features: [
        'Everything in Professional',
        'Multi-location management',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'White-label solutions',
        'Advanced analytics',
        'Custom training'
      ],
      cta: 'Contact Sales'
    }
  ]

  return (
    <UXWrapper>
      <UXSection 
        title="Choose Your Plan"
        subtitle="Transform your restaurant menu into a mobile-friendly QR code menu. Start with our free trial - no credit card required."
      >
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {pricingTiers.map((tier) => (
            <UXCard 
              key={tier.name} 
              className={`relative ${tier.recommended ? 'ring-2 ring-ux-primary shadow-xl scale-105' : ''} hover:shadow-lg transition-all duration-200`}
              role="article"
              aria-labelledby={`tier-${tier.id}-title`}
            >
              {tier.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-ux-primary text-ux-text px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <h3 id={`tier-${tier.id}-title`} className="text-2xl font-bold text-ux-text mb-2">{tier.name}</h3>
                <p className="text-ux-text-secondary mb-4 min-h-[3rem]">{tier.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-ux-text">{tier.price}</span>
                  <span className="text-ux-text-secondary text-lg">{tier.period}</span>
                </div>
                
                <ul className="space-y-3 mb-8 text-left">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start text-ux-text-secondary">
                      <svg className="w-5 h-5 text-ux-success mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <UXButton 
                  variant={tier.recommended ? 'primary' : 'outline'} 
                  className="w-full"
                  size="lg"
                  aria-label={`${tier.cta} for ${tier.name} plan at ${tier.price}${tier.period}`}
                >
                  {tier.cta}
                </UXButton>
              </div>
            </UXCard>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-ux-text text-center mb-8">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-ux-text mb-2">Is there a free trial?</h4>
                <p className="text-ux-text-secondary">Yes! All plans come with a 14-day free trial. No credit card required to get started.</p>
              </div>
              <div>
                <h4 className="font-semibold text-ux-text mb-2">Can I change plans anytime?</h4>
                <p className="text-ux-text-secondary">Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
              </div>
              <div>
                <h4 className="font-semibold text-ux-text mb-2">What payment methods do you accept?</h4>
                <p className="text-ux-text-secondary">We accept all major credit cards, PayPal, and bank transfers for Enterprise customers.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-ux-text mb-2">Do you offer refunds?</h4>
                <p className="text-ux-text-secondary">Yes, we offer a 30-day money-back guarantee if you're not satisfied with our service.</p>
              </div>
              <div>
                <h4 className="font-semibold text-ux-text mb-2">Is my data secure?</h4>
                <p className="text-ux-text-secondary">Your data is encrypted and stored securely. We're GDPR compliant and never share your information.</p>
              </div>
              <div>
                <h4 className="font-semibold text-ux-text mb-2">Need help choosing?</h4>
                <p className="text-ux-text-secondary">
                  <Link href="/support" className="text-ux-primary hover:underline">Contact our team</Link> for personalized recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-12 p-8 bg-ux-background-secondary rounded-xl">
          <h3 className="text-2xl font-bold text-ux-text mb-4">Ready to get started?</h3>
          <p className="text-ux-text-secondary mb-6 max-w-2xl mx-auto">
            Join thousands of restaurants already using GridMenu to improve their customer experience and increase sales.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/ux">
              <UXButton variant="primary" size="lg">
                Try Demo Menu
              </UXButton>
            </Link>
            <Link href="/ux/register">
              <UXButton variant="outline" size="lg">
                Create Account
              </UXButton>
            </Link>
          </div>
        </div>
      </UXSection>
    </UXWrapper>
  )
}