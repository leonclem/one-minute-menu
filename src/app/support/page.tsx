import Link from 'next/link'
import { UXHeader, UXFooter, UXCard, UXButton } from '@/components/ux'

export default function SupportPage() {
  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image + soft overlay behind header and main, does not affect layout height */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/ux/backgrounds/kung-pao-chicken.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%',
        }}
      />

      <UXHeader />

      <main className="container-ux py-10 md:py-12">
        {/* Hero heading */}
        <div className="text-center mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white text-hero-shadow">Support</h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">We’re here to help</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Options */}
          <UXCard>
            <div className="relative z-10">
              <h3 className="text-lg font-semibold text-ux-text mb-4">Get in Touch</h3>
              <div className="space-y-4">
                <div className="rounded-md border border-ux-border p-4 bg-white/70">
                  <h4 className="font-medium text-ux-text mb-2">Email Support</h4>
                  <p className="text-sm text-ux-text-secondary mb-2">
                    Get help with your account or technical issues
                  </p>
                  <a
                    href="mailto:support@qrmenusystem.com"
                    className="text-ux-primary hover:opacity-90 text-sm font-medium"
                  >
                    support@qrmenusystem.com
                  </a>
                </div>

                <div className="rounded-md border border-ux-border p-4 bg-white/70">
                  <h4 className="font-medium text-ux-text mb-2">Sales Inquiries</h4>
                  <p className="text-sm text-ux-text-secondary mb-2">
                    Questions about pricing or custom solutions
                  </p>
                  <a
                    href="mailto:sales@qrmenusystem.com"
                    className="text-ux-primary hover:opacity-90 text-sm font-medium"
                  >
                    sales@qrmenusystem.com
                  </a>
                </div>
              </div>
            </div>
          </UXCard>

          {/* FAQ */}
          <UXCard>
            <div className="relative z-10">
              <h3 className="text-lg font-semibold text-ux-text mb-4">Frequently Asked Questions</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-ux-text mb-2">How do I create my first menu?</h4>
                  <p className="text-sm text-ux-text-secondary">
                    After signing up, click &quot;Create your first menu&quot; and either upload a photo of your
                    existing menu or start from scratch.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-ux-text mb-2">Can I customize the design?</h4>
                  <p className="text-sm text-ux-text-secondary">
                    Yes! Upload your logo and we&apos;ll automatically match your restaurant&apos;s colors and branding.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-ux-text mb-2">How do customers access my menu?</h4>
                  <p className="text-sm text-ux-text-secondary">
                    We provide a QR code that customers can scan with their phone camera to view your menu instantly.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-ux-text mb-2">Is there a free plan?</h4>
                  <p className="text-sm text-ux-text-secondary">
                    Yes! Our free plan includes 1 menu with all basic features. Premium plans offer more menus and
                    advanced features.
                  </p>
                </div>
              </div>
            </div>
          </UXCard>
        </div>

        {/* Getting Started CTA */}
        <UXCard className="mt-6 md:mt-8">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold text-ux-text mb-2">Ready to Get Started?</h3>
            <p className="text-ux-text-secondary mb-4">
              Create your digital menu in under 5 minutes with our simple setup process.
            </p>
            <Link href="/auth/signup">
              <UXButton variant="primary" size="lg">Create Your Menu</UXButton>
            </Link>
          </div>
        </UXCard>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center text-sm rounded-full bg-white/20 border border-white/40 text-white hover:bg-white/30 px-4 py-2 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      <UXFooter />
    </div>
  )
}