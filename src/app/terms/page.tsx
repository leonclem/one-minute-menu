import Link from 'next/link'

export default function TermsPage() {
  const lastUpdated = new Date('2026-01-11').toLocaleDateString()

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
              Get Started
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
                By accessing and using GridMenu ("the Service"), provided by GORRRF Private Ltd (UEN: 202550882W), you accept and agree to be bound by the 
                terms and provision of this agreement. These terms apply to all visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Subscription and Fees</h2>
              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">2.1 Monthly Subscriptions</h3>
              <p>
                Grid+ and Grid+Premium plans are billed on a recurring monthly basis. You may cancel your subscription at any time through your account settings. Cancellation will be effective at the end of the current billing cycle. No partial refunds are provided for mid-month cancellations.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">2.2 Creator Packs</h3>
              <p>
                Creator Packs are one-time purchases. Each Creator Pack grants the right to maintain one active menu for up to 24 months from the date of purchase.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">2.3 Refund Policy</h3>
              <p>
                Refunds are only available for your <strong>first purchase</strong> (either a subscription or a Creator Pack) within 30 days. We reserve the right to deny refund requests if the Service has been used extensively (e.g., more than 3 PDF exports or 50 image regenerations).
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Fair Use Policy</h2>
              <p>
                Our "unlimited" features (such as edits and regenerations) are subject to a fair use policy. To ensure service quality for all users, we monitor for abusive patterns. We reserve the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Automatedly throttle accounts exceeding typical usage patterns.</li>
                <li>Restrict or suspend access for accounts identified as bots or scripts.</li>
                <li>Limit concurrent generation requests during peak load periods.</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Expiry and Termination</h2>
              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">4.1 Pack Expiry</h3>
              <p>
                Creator Packs expire 24 months after purchase. Upon expiry, the associated menu will revert to "expired" status. To continue editing or displaying the menu, a new Pack or active subscription is required.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">4.2 Account Termination</h3>
              <p>
                We reserve the right to terminate or suspend access to our Service immediately, without prior notice or liability, for any reason, including without limitation:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Breach of these Terms.</li>
                <li>Fraudulent or suspicious activity.</li>
                <li>Abandoned accounts (no login for 12+ months).</li>
                <li>Business shutdown or regulatory changes.</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Use License</h2>
              <p>
                Permission is granted to use GridMenu for your restaurant's business purposes. This is a license, not a transfer of title. You may not:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Modify or copy the platform's underlying source code.</li>
                <li>Use the service for any illegal purpose.</li>
                <li>Attempt to decompile or reverse engineer any software contained in GridMenu.</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:legal@gridmenu.ai" className="text-ux-primary hover:underline font-bold">
                  legal@gridmenu.ai
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
