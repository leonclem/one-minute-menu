import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-primary-600">
              QR Menu System
            </Link>
            <Link 
              href="/auth/signup" 
              className="btn btn-primary px-4 py-2 text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="py-12">
        <div className="container-mobile max-w-4xl">
          <h1 className="text-3xl font-bold text-secondary-900 mb-8">Terms of Service</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-secondary-600 mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Acceptance of Terms</h2>
              <p className="text-secondary-700 mb-4">
                By accessing and using QR Menu System, you accept and agree to be bound by the 
                terms and provision of this agreement.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Use License</h2>
              <p className="text-secondary-700 mb-4">
                Permission is granted to temporarily use QR Menu System for personal, 
                non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">User Account</h2>
              <p className="text-secondary-700 mb-4">
                You are responsible for safeguarding the password and for maintaining the 
                confidentiality of your account information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Prohibited Uses</h2>
              <p className="text-secondary-700 mb-4">
                You may not use our service for any unlawful purpose or to solicit others to 
                perform unlawful acts.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Service Availability</h2>
              <p className="text-secondary-700 mb-4">
                We reserve the right to modify or discontinue the service at any time without notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Contact Information</h2>
              <p className="text-secondary-700 mb-4">
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:legal@qrmenusystem.com" className="text-primary-600 hover:text-primary-500">
                  legal@qrmenusystem.com
                </a>
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-secondary-200">
            <Link 
              href="/" 
              className="text-primary-600 hover:text-primary-500"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}