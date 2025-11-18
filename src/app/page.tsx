import Link from 'next/link'

export default function HomePage() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.app'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GridMenu',
    url: siteUrl,
    description: 'Create digital menus with QR codes for restaurants. Turn your existing menu into a mobile-friendly experience in minutes.',
    potentialAction: {
      '@type': 'RegisterAction',
      target: `${siteUrl}/auth/signup`,
    },
  }

  return (
    <main className="flex min-h-screen flex-col">
      <head>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      {/* Hero Section */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="container-mobile">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-secondary-900 sm:text-5xl lg:text-6xl">
            Digital Menus Made{' '}
            <span className="text-primary-600">Simple</span>
          </h1>
          
          <p className="mb-8 text-lg text-secondary-600 sm:text-xl">
            Transform your paper menu into a mobile-friendly QR code menu in under 5 minutes. 
            No tech skills required.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link 
              href="/auth/signup" 
              className="btn btn-primary px-8 py-3 text-base"
            >
              Get Started Free
            </Link>
            <Link 
              href="/onboarding/demo" 
              className="btn btn-outline px-8 py-3 text-base"
            >
              Try Demo
            </Link>
          </div>

          {/* Features Preview */}
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-secondary-900">Photo to Menu</h3>
              <p className="text-sm text-secondary-600">
                Just snap a photo of your existing menu and our AI extracts all items automatically
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-secondary-900">Brand Styling</h3>
              <p className="text-sm text-secondary-600">
                Upload your logo and we'll match your restaurant's colors and style
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-secondary-900">QR Code Ready</h3>
              <p className="text-sm text-secondary-600">
                Get a QR code that customers can scan to view your mobile-optimized menu
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-secondary-200 py-8">
        <div className="container-mobile">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-secondary-600">
              © 2024 GridMenu. Built for restaurants.
            </p>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-secondary-600 hover:text-secondary-900">
                Privacy
              </Link>
              <Link href="/terms" className="text-secondary-600 hover:text-secondary-900">
                Terms
              </Link>
              <Link href="/support" className="text-secondary-600 hover:text-secondary-900">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}