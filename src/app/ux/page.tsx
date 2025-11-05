import { UXWrapper, UXSection, UXButton, UXCard } from '@/components/ux'
import Link from 'next/link'

export default function UXHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ux-background to-ux-background-secondary">
      {/* Hero Section */}
      <UXWrapper variant="centered">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-ux-text mb-6">
            Create Your Digital Menu in{' '}
            <span className="text-ux-primary">Minutes</span>
          </h1>
          <p className="text-xl md:text-2xl text-ux-text-secondary mb-8 max-w-3xl mx-auto">
            Transform your restaurant menu into a mobile-friendly QR code menu. 
            Upload your existing menu or try our demo to see the magic happen.
          </p>
          
          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link href="/ux/register" className="w-full sm:w-auto">
              <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[280px]">
                Upload your existing menu
              </UXButton>
            </Link>
            <Link href="/ux/demo/sample" className="w-full sm:w-auto">
              <UXButton variant="outline" size="lg" className="w-full sm:w-auto min-w-[280px]">
                Use a sample menu
              </UXButton>
            </Link>
          </div>
          
          {/* Hero Image Placeholder */}
          <div className="placeholder-ux w-full max-w-4xl h-80 md:h-96 mx-auto rounded-2xl">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 bg-ux-primary rounded-full mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-ux-text" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <span className="text-ux-text-secondary text-lg font-medium">Menu Creation Demo</span>
            </div>
          </div>
        </div>
      </UXWrapper>

      {/* Features Section */}
      <UXSection 
        title="Why Choose GridMenu?"
        subtitle="Everything you need to create professional digital menus"
        className="bg-white"
      >
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <UXCard className="text-center">
            <div className="w-12 h-12 bg-ux-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-ux-text" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-ux-text mb-2">Easy Upload</h3>
            <p className="text-ux-text-secondary">
              Simply upload your existing menu image and our AI will extract all items automatically
            </p>
          </UXCard>
          
          <UXCard className="text-center">
            <div className="w-12 h-12 bg-ux-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-ux-text" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-ux-text mb-2">Mobile Optimized</h3>
            <p className="text-ux-text-secondary">
              Your menu will look perfect on any device with responsive design and fast loading
            </p>
          </UXCard>
          
          <UXCard className="text-center">
            <div className="w-12 h-12 bg-ux-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-ux-text" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-ux-text mb-2">Multiple Formats</h3>
            <p className="text-ux-text-secondary">
              Export as PDF, images, HTML, or get a QR code for instant customer access
            </p>
          </UXCard>
        </div>
      </UXSection>

      {/* Social Proof Section */}
      <UXSection className="bg-ux-background-secondary">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-ux-text mb-8">
            Trusted by Restaurants Worldwide
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-ux-primary mb-2">10,000+</div>
              <div className="text-ux-text-secondary">Menus Created</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-ux-primary mb-2">50+</div>
              <div className="text-ux-text-secondary">Countries</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-ux-primary mb-2">99%</div>
              <div className="text-ux-text-secondary">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </UXSection>

      {/* Final CTA Section */}
      <UXSection 
        title="Ready to Get Started?"
        subtitle="Join thousands of restaurants already using GridMenu"
        className="bg-white"
      >
        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/ux/register" className="w-full sm:w-auto">
              <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[280px]">
                Start with your menu
              </UXButton>
            </Link>
            <Link href="/ux/demo/sample" className="w-full sm:w-auto">
              <UXButton variant="secondary" size="lg" className="w-full sm:w-auto min-w-[280px]">
                Try the demo first
              </UXButton>
            </Link>
          </div>
          <p className="text-sm text-ux-text-secondary mt-4">
            No credit card required • Free demo available
          </p>
        </div>
      </UXSection>
    </div>
  )
}