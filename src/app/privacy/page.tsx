import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-primary-600">
              GridMenu
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
          <h1 className="text-3xl font-bold text-secondary-900 mb-8">Privacy Policy</h1>

          <div className="prose prose-lg max-w-none">
            <p className="text-secondary-600 mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Information We Collect</h2>
              <p className="text-secondary-700 mb-4">
                We collect information you provide directly to us, such as when you create an account,
                upload menu content, or contact us for support.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">How We Use Your Information</h2>
              <p className="text-secondary-700 mb-4">
                We use the information we collect to provide, maintain, and improve our services,
                process transactions, and communicate with you.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Analytics and Cookies</h2>
              <p className="text-secondary-700 mb-4">
                GridMenu uses essential cookies provided by our authentication provider (Supabase) to keep you
                securely signed in. For analytics, we use a privacy-friendly approach that does not store IP
                addresses or other directly identifiable information. Instead, we use a short-lived identifier
                in your browser&apos;s local storage to estimate unique visitors.
              </p>
              <p className="text-secondary-700 mb-4">
                You can choose whether to allow analytics when you first visit the site via the consent banner
                at the bottom of the page. You can change your choice at any time by clearing your browser
                storage for this site and revisiting the banner, or by contacting us at the email address below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Information Sharing</h2>
              <p className="text-secondary-700 mb-4">
                We do not sell, trade, or otherwise transfer your personal information to third parties
                without your consent, except as described in this policy or as required by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Data Security</h2>
              <p className="text-secondary-700 mb-4">
                We implement appropriate technical and organizational measures to protect your personal
                information against unauthorized access, alteration, disclosure, or destruction. This includes
                enforcing secure (HTTPS) connections in production and using secure, HTTP-only cookies for
                authentication sessions provided by Supabase.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Your Rights</h2>
              <p className="text-secondary-700 mb-4">
                Depending on your location, you may have rights under applicable data protection laws,
                including the right to access, correct, or delete your personal data, and the right to
                object to or restrict certain processing activities.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Contact Us</h2>
              <p className="text-secondary-700 mb-4">
                If you have any questions about this Privacy Policy or would like to exercise your rights,
                please contact us at{' '}
                <a href="mailto:privacy@qrmenusystem.com" className="text-primary-600 hover:text-primary-500">
                  privacy@qrmenusystem.com
                </a>
                .
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