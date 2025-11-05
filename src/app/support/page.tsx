import Link from 'next/link'

export default function SupportPage() {
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
          <h1 className="text-3xl font-bold text-secondary-900 mb-8">Support</h1>
          
          <div className="grid gap-8 md:grid-cols-2">
            {/* Contact Options */}
            <div>
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Get in Touch</h2>
              <div className="space-y-4">
                <div className="p-4 border border-secondary-200 rounded-lg">
                  <h3 className="font-medium text-secondary-900 mb-2">Email Support</h3>
                  <p className="text-sm text-secondary-600 mb-2">
                    Get help with your account or technical issues
                  </p>
                  <a 
                    href="mailto:support@qrmenusystem.com" 
                    className="text-primary-600 hover:text-primary-500 text-sm font-medium"
                  >
                    support@qrmenusystem.com
                  </a>
                </div>

                <div className="p-4 border border-secondary-200 rounded-lg">
                  <h3 className="font-medium text-secondary-900 mb-2">Sales Inquiries</h3>
                  <p className="text-sm text-secondary-600 mb-2">
                    Questions about pricing or custom solutions
                  </p>
                  <a 
                    href="mailto:sales@qrmenusystem.com" 
                    className="text-primary-600 hover:text-primary-500 text-sm font-medium"
                  >
                    sales@qrmenusystem.com
                  </a>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-secondary-900 mb-2">How do I create my first menu?</h3>
                  <p className="text-sm text-secondary-600">
                    After signing up, click "Create your first menu" and either upload a photo of your 
                    existing menu or start from scratch.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-secondary-900 mb-2">Can I customize the design?</h3>
                  <p className="text-sm text-secondary-600">
                    Yes! Upload your logo and we'll automatically match your restaurant's colors and branding.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-secondary-900 mb-2">How do customers access my menu?</h3>
                  <p className="text-sm text-secondary-600">
                    We provide a QR code that customers can scan with their phone camera to view your menu instantly.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-secondary-900 mb-2">Is there a free plan?</h3>
                  <p className="text-sm text-secondary-600">
                    Yes! Our free plan includes 1 menu with all basic features. Premium plans offer more menus and advanced features.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div className="mt-12 p-6 bg-primary-50 rounded-lg">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4">Ready to Get Started?</h2>
            <p className="text-secondary-700 mb-4">
              Create your digital menu in under 5 minutes with our simple setup process.
            </p>
            <Link 
              href="/auth/signup" 
              className="btn btn-primary"
            >
              Create Your Menu
            </Link>
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