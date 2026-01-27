import Link from 'next/link'
import { UXHeader, UXFooter, UXCard, UXButton } from '@/components/ux'

export default function SupportPage() {
  return (
    <div className="ux-implementation min-h-dvh md:min-h-screen flex flex-col flex-grow overflow-x-hidden relative">
      {/* Background image fixed to viewport so tall UX pages scroll over it without stretching */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%',
        }}
      />

      <UXHeader />

      <main className="container-ux py-10 md:py-12 flex-1">
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
                    href="mailto:support@gridmenu.ai"
                    className="text-ux-primary hover:opacity-90 text-sm font-medium"
                  >
                    support@gridmenu.ai
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
        <UXCard className="mt-6 md:mt-8 text-center bg-white/10 backdrop-blur-md border-white/20 shadow-xl">
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-white text-hero-shadow mb-2">Ready to Get Started?</h3>
            <p className="text-white/80 text-hero-shadow-strong mb-6 max-w-lg mx-auto">
              Create your digital menu in under 5 minutes with our simple setup process.
            </p>
            <Link href="/register">
              <UXButton variant="primary" size="lg" className="px-8 shadow-lg">
                Create Your Menu
              </UXButton>
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