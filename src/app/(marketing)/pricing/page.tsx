import { UXWrapper, UXCard, UXButton } from '@/components/ux'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing - Menu Export Packs | GridMenu',
  description: 'Create beautiful, photo-perfect menus in minutes. Design free, pay only when you export. One-time purchase packs starting at $29.',
  keywords: ['menu export pricing', 'AI menu pricing', 'restaurant menu design', 'menu creation cost'],
  openGraph: {
    title: 'Pricing - Menu Export Packs | GridMenu',
    description: 'Design free. Pay only when exporting your final menu. One-time purchase packs starting at $29.',
    type: 'website',
  },
}

export default function UXPricingPage() {
  const pricingTiers = [
    {
      id: 'starter',
      name: 'Starter Pack',
      price: '$29',
      period: 'One-time purchase',
      description: 'Perfect for cafés and independent restaurants creating their first AI-generated menu.',
      features: [
        '1 full menu export (PDF + images)',
        'Unlimited design edits',
        'Unlimited image regenerations (fair-use capped)',
        'All standard templates',
        'Mobile-ready layout',
        'Add QR code for your payment system',
        'Email support'
      ],
      cta: 'Buy Starter Pack',
      subtext: 'One export credit included. More credits can be purchased anytime.'
    },
    {
      id: 'professional',
      name: 'Professional Pack',
      price: '$59',
      period: 'One-time purchase',
      recommended: true,
      description: 'Best for restaurants creating multiple menus (lunch, dinner, brunch, seasonal).',
      features: [
        '3 menu exports',
        'Unlimited design edits',
        'Unlimited image regenerations (fair-use capped)',
        'All templates included',
        'Faster image generation',
        'Brand styling options (colours & logo presets)',
        'Add QR code for your payment system',
        'Priority support'
      ],
      cta: 'Buy Professional Pack',
      subtext: 'Best value for restaurants with multiple menu types.'
    },
    {
      id: 'proplus',
      name: 'Pro+ Pack',
      price: '$119',
      period: 'One-time purchase',
      description: 'Ideal for restaurants updating menus regularly or preparing a full year of specials.',
      features: [
        '10 menu exports',
        'Unlimited design edits',
        'Unlimited image regenerations (fair-use capped)',
        'All templates included',
        'Priority rendering queue',
        'Future updates included for your purchased exports',
        'Add QR code for your payment system',
        'Branding toolkit'
      ],
      cta: 'Buy Pro+ Pack',
      subtext: 'Ideal for seasonal menus, weekly specials, or rapid experimentation.'
    }
  ]

  return (
    <UXWrapper>
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white text-hero-shadow mb-4">
          Choose Your Menu Pack
        </h1>
        <p className="text-lg text-white/90 text-hero-shadow-strong max-w-2xl mx-auto">
          Create beautiful, photo-perfect menus in minutes. Start free. Pay only when you export a final menu.
        </p>
      </div>

      <div className="container-ux">
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12 pt-12">
          {pricingTiers.map((tier) => (
            <UXCard 
              key={tier.name} 
              className={`relative ${tier.recommended ? 'ring-2 ring-ux-primary shadow-xl scale-105' : ''} hover:shadow-lg transition-all duration-200`}
              role="article"
              aria-labelledby={`tier-${tier.id}-title`}
            >
              <div className="text-center">
                {tier.recommended && (
                  <div className="mb-4 -mt-2">
                    <span className="inline-block bg-ux-primary text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                      Recommended
                    </span>
                  </div>
                )}
                <h3 id={`tier-${tier.id}-title`} className="text-2xl font-bold text-ux-text mb-2">{tier.name}</h3>
                <p className="text-gray-700 mb-4 min-h-[3rem]">{tier.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-ux-text">{tier.price}</span>
                  <span className="text-gray-700 text-sm block mt-1">{tier.period}</span>
                </div>
                
                <ul className="space-y-3 mb-6 text-left">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start text-gray-700">
                      <svg className="w-5 h-5 text-ux-success mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <UXButton 
                  variant={tier.recommended ? 'primary' : 'outline'} 
                  className="w-full mb-3"
                  size="lg"
                  aria-label={`${tier.cta} for ${tier.name} at ${tier.price}`}
                >
                  {tier.cta}
                </UXButton>
                
                {tier.subtext && (
                  <p className="text-xs text-gray-700 italic">{tier.subtext}</p>
                )}
              </div>
            </UXCard>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-ux-primary/30 to-ux-primary/40 rounded-md p-8 border border-ux-primary/40">
          <h3 className="text-2xl font-bold text-white text-hero-shadow text-center mb-8">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-2">Is there a free trial?</h4>
                <p className="text-white/90 text-sm">Yes. You can design your menu and generate preview images for free. Payment is only required when you export the final high-resolution menu.</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Do my export credits expire?</h4>
                <p className="text-white/90 text-sm">No. Credits never expire. Use them whenever you need a new menu.</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Can I upgrade later?</h4>
                <p className="text-white/90 text-sm">Yes. You can purchase additional packs at any time. They are added to your account immediately.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-2">What payment methods do you accept?</h4>
                <p className="text-white/90 text-sm">We accept all major credit cards and PayPal.</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Do you offer refunds?</h4>
                <p className="text-white/90 text-sm">Yes. If you are not satisfied with your exported menu, we offer a 30-day money-back guarantee.</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Is my data secure?</h4>
                <p className="text-white/90 text-sm">Your data is encrypted and stored securely. We are GDPR-compliant and never share your information.</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Need help choosing?</h4>
                <p className="text-white/90 text-sm">
                  <Link href="/support" className="text-white hover:underline font-semibold underline">Contact us</Link> for personalised recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <UXCard className="text-center mt-12">
          <h3 className="text-2xl font-bold text-ux-text mb-4">Ready to get started?</h3>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Design free. Pay only when you export. No credit card required to start.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <UXButton variant="primary" size="lg">
                Try Free Now
              </UXButton>
            </Link>
            <Link href="/register">
              <UXButton variant="warning" size="lg">
                Create Account
              </UXButton>
            </Link>
          </div>
        </UXCard>
      </div>
    </UXWrapper>
  )
}