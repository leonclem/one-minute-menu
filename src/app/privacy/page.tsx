import Link from 'next/link'

export default function PrivacyPage() {
  const lastUpdated = '11/01/2026'

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
              href="/auth/signup" 
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
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-500 mb-12">Last updated: {lastUpdated}</p>
          
          <div className="prose prose-blue prose-lg max-w-none text-gray-600">
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Information We Collect</h2>
              <p>
                We collect information you provide directly to us, including when you create an account, upload menu content, communicate with us, or otherwise use our services.
              </p>
              <p>
                This may include account details, contact information, menu content, images, and other information you choose to provide.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Provide, operate, and maintain our services</li>
                <li>Process transactions and manage accounts</li>
                <li>Communicate with you about your account or our services</li>
                <li>Improve, develop, and optimise our products and user experience</li>
                <li>Ensure security, prevent abuse, and comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Analytics and Cookies</h2>
              <p>
                GridMenu uses essential cookies provided by our authentication provider (Supabase) to keep you securely signed in.
              </p>
              <p>
                For analytics, we use a privacy-friendly approach that does not store IP addresses or other directly identifiable information. Instead, we use a short-lived identifier stored in your browser’s local storage to estimate unique visitors and understand general usage patterns.
              </p>
              <p>
                You can choose whether to allow analytics when you first visit the site via the consent banner. You can change your choice at any time by clearing your browser storage for this site and revisiting the banner, or by contacting us using the details below.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Aggregated and Anonymised Data</h2>
              <p>We may generate aggregated, anonymised, or statistical data derived from the use of our services. This data:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Does not identify you or your business</li>
                <li>Cannot reasonably be used to re-identify individuals</li>
                <li>Is used to understand trends, improve our services, and develop new features</li>
              </ul>
              <p className="mt-4">
                Such aggregated or anonymised data may also be used by GridMenu for research, benchmarking, analytics, reporting, and commercial purposes, including the development of data-driven products or insights.
              </p>
              <p>
                Customers retain ownership of their original content. GridMenu retains ownership of aggregated, anonymised, or derivative data generated through the operation of the platform.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Information Sharing</h2>
              <p>We do not sell or disclose your personal information to third parties except:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>To service providers who process data on our behalf (such as hosting, authentication, or analytics providers), under appropriate safeguards</li>
                <li>Where required by law or legal process</li>
                <li>With your explicit consent</li>
              </ul>
              <p className="mt-4">We do not share identifiable customer data for third-party marketing purposes.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Security</h2>
              <p>
                We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. These measures include secure (HTTPS) connections in production and secure, HTTP-only cookies for authentication sessions provided by Supabase.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rights</h2>
              <p>Depending on your location and applicable law, you may have rights including:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>The right to access your personal data</li>
                <li>The right to correct or update inaccurate data</li>
                <li>The right to request deletion of your personal data</li>
                <li>The right to object to or restrict certain processing activities</li>
              </ul>
              <p className="mt-4">To exercise these rights, please contact us using the details below.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated “Last updated” date. Material changes will be communicated where required by law.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
              </p>
              <p className="mt-4">
                <a href="mailto:privacy@gridmenu.ai" className="text-ux-primary hover:underline font-bold">
                  privacy@gridmenu.ai
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
