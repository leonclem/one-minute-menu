import Link from 'next/link'
import type { Metadata } from 'next'
import { isStudioPublicSurface } from '@/lib/product-mode'

export const metadata: Metadata = {
  title: 'Terms of Service | GridMenu',
  description: 'Terms of Service for GridMenu.',
}

export default function TermsPage() {
  const lastUpdated = '14/08/2026'
  const studioPublic = isStudioPublicSurface()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-2xl font-black text-ux-primary tracking-tight">
              GridMenu
            </Link>
            <Link 
              href="/register" 
              className="bg-ux-primary text-white px-6 py-2 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
            >
              {studioPublic ? 'Join the waitlist' : 'Get Started'}
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-gray-500 mb-12">Last updated: {lastUpdated}</p>
          
          <div className="prose prose-blue prose-lg max-w-none text-gray-600">
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using GridMenu (&quot;the Service&quot;), the public-facing brand of Gorrrf Private
                Limited (UEN: 202550882W), you accept and agree to be bound by the terms and provision of this
                agreement. These terms apply to all visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Photo Studio</h2>
              <p>
                Photo Studio is currently a private beta. Access is invite-only and is not a paid Studio plan.
                During the beta, Studio credits are granted by an administrator. There is no generation service
                level agreement. Generated images may include a watermark applied by the image-generation
                provider.
              </p>
              <p className="mt-4">
                You own your uploaded source photos and the Studio image variants generated for your account.
                We may contact you to ask permission if we would like to use those outputs in a GridMenu
                feature or publication.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Fees</h2>
              <p>
                There is no self-serve Studio purchase on the site today. Paid credit packs may be offered
                later. When purchased, a credit pack will be valid for 12 months from the date of purchase.
                Pack names, prices, and any subscription options will be shown at checkout when they are
                available.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Fair Use</h2>
              <p>
                To keep the Service reliable for everyone, we monitor for abusive patterns. We reserve the
                right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Throttle accounts that exceed typical usage patterns.</li>
                <li>Restrict or suspend access for accounts identified as bots or scripts.</li>
                <li>Limit concurrent generation requests during peak load periods.</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Account Termination</h2>
              <p>
                We reserve the right to terminate or suspend access to our Service immediately, without prior
                notice or liability, for any reason, including without limitation:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Breach of these Terms.</li>
                <li>Fraudulent or suspicious activity.</li>
                <li>Abandoned accounts (no login for 12+ months).</li>
                <li>Business shutdown or regulatory changes.</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Use License</h2>
              <p>
                Permission is granted to use GridMenu for your business purposes. This is a license, not a
                transfer of title. You may not:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Modify or copy the platform&apos;s underlying source code.</li>
                <li>Use the service for any illegal purpose.</li>
                <li>Attempt to decompile or reverse engineer any software contained in GridMenu.</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:support@gridmenu.ai" className="text-ux-primary hover:underline font-bold">
                  support@gridmenu.ai
                </a>
              </p>
            </section>
          </div>

          <div className="mt-16 pt-8 border-t border-gray-200">
            <Link 
              href="/" 
              className="text-ux-primary hover:underline font-bold flex items-center gap-2"
            >
              <span>←</span> Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
