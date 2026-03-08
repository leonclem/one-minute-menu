import type { Metadata } from 'next'
import Link from 'next/link'
import { UXCard } from '@/components/ux'

export const metadata: Metadata = {
  title: 'Rate Limits & Fair Use Policy | GridMenu',
  description:
    'Detailed breakdown of rate limits, quotas, and fair use policies for all GridMenu plans.',
}

const LIMITS = [
  {
    feature: 'AI Image Generations',
    free: '50 total',
    creatorPack: '200 total',
    gridPlus: '300 / month',
    premium: '1,000 / month',
  },
  {
    feature: 'Generation Speed',
    free: '5 / minute',
    creatorPack: '5 / minute',
    gridPlus: '15 / minute',
    premium: '30 / minute',
  },
  {
    feature: 'Batch Size',
    free: '5 items',
    creatorPack: '5 items',
    gridPlus: '15 items',
    premium: '20 items',
  },
  {
    feature: 'Exports per Minute',
    free: '3 (5 min cooldown)',
    creatorPack: '3 (5 min cooldown)',
    gridPlus: '10 (1 min cooldown)',
    premium: '20 (30s cooldown)',
  },
  {
    feature: 'Active Menus',
    free: '1',
    creatorPack: '1 per pack',
    gridPlus: '5',
    premium: 'Unlimited',
  },
  {
    feature: 'Menu Items',
    free: '40',
    creatorPack: '40',
    gridPlus: '500',
    premium: 'Unlimited',
  },
  {
    feature: 'Menu Deletion',
    free: 'Not available',
    creatorPack: 'Not available',
    gridPlus: 'Yes',
    premium: 'Yes',
  },
  {
    feature: 'OCR Extractions',
    free: '2 / hour, 5 / month',
    creatorPack: '2 / hour, 5 / month',
    gridPlus: '20 / hour, 100 / month',
    premium: '60 / hour, Unlimited',
  },
  {
    feature: 'Export Storage',
    free: '30 days',
    creatorPack: '30 days',
    gridPlus: '90 days',
    premium: '180 days',
  },
]

export default function RateLimitsPage() {
  return (
    <section className="container-ux w-full py-10 md:py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white text-hero-shadow">
          Rate Limits &amp; Fair Use
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong max-w-2xl mx-auto">
          A transparent breakdown of usage limits across all GridMenu plans.
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <UXCard>
          <div className="relative z-10 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-ux-border">
                  <th className="py-3 px-4 font-semibold text-ux-text">Feature</th>
                  <th className="py-3 px-4 font-semibold text-ux-text text-center">
                    Free Creator Pack
                  </th>
                  <th className="py-3 px-4 font-semibold text-ux-text text-center">
                    Creator Pack
                  </th>
                  <th className="py-3 px-4 font-semibold text-ux-text text-center">Grid+</th>
                  <th className="py-3 px-4 font-semibold text-ux-text text-center">
                    Grid+Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {LIMITS.map((row) => (
                  <tr key={row.feature} className="border-b border-ux-border/50 last:border-0">
                    <td className="py-3 px-4 font-medium text-ux-text">{row.feature}</td>
                    <td className="py-3 px-4 text-ux-text-secondary text-center">{row.free}</td>
                    <td className="py-3 px-4 text-ux-text-secondary text-center">
                      {row.creatorPack}
                    </td>
                    <td className="py-3 px-4 text-ux-text-secondary text-center">
                      {row.gridPlus}
                    </td>
                    <td className="py-3 px-4 text-ux-text-secondary text-center">
                      {row.premium}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </UXCard>

        <div className="mt-8 max-w-3xl mx-auto">
          <UXCard>
            <div className="relative z-10 p-2">
              <h3 className="text-lg font-semibold text-ux-text mb-3">Fair Use Policy</h3>
              <div className="space-y-3 text-sm text-ux-text-secondary leading-relaxed">
                <p>
                  GridMenu applies rate limits to maintain service quality and prevent abuse.
                  Limits are enforced per account and reset automatically at the end of each
                  window.
                </p>
                <p>
                  If you hit a rate limit, the UI will show a countdown timer indicating when
                  you can make a new request to GridMenu.
                </p>
                <p>
                  Need higher limits?{' '}
                  <Link href="/pricing" className="text-ux-primary hover:opacity-90 font-medium">
                    Upgrade your plan
                  </Link>{' '}
                  or{' '}
                  <a
                    href="mailto:support@gridmenu.ai"
                    className="text-ux-primary hover:opacity-90 font-medium"
                  >
                    contact us
                  </a>{' '}
                  for enterprise options.
                </p>
              </div>
            </div>
          </UXCard>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/pricing"
          className="inline-flex items-center text-sm rounded-full bg-white/20 border border-white/40 text-white hover:bg-white/30 px-4 py-2 transition-colors"
        >
          ← Back to Pricing
        </Link>
      </div>
    </section>
  )
}
