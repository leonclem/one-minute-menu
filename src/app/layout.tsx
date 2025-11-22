import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui'
import { ConsentBanner } from '@/components/privacy/ConsentBanner'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  adjustFontFallback: true,
  fallback: ['system-ui', 'arial'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#3B82F6',
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.app'

export const metadata: Metadata = {
  title: 'GridMenu',
  description: 'Create digital menus with QR codes for restaurants',
  manifest: '/manifest.json',
  metadataBase: new URL(siteUrl),
  icons: [
    {
      rel: 'icon',
      url: '/logos/favicon-16.png',
      sizes: '16x16',
      type: 'image/png',
    },
    {
      rel: 'icon',
      url: '/logos/favicon-32.png',
      sizes: '32x32',
      type: 'image/png',
    },
    {
      rel: 'icon',
      url: '/logos/favicon-48.png',
      sizes: '48x48',
      type: 'image/png',
    },
    {
      rel: 'icon',
      url: '/favicon.ico',
      sizes: 'any',
      type: 'image/x-icon',
    },
    { rel: 'shortcut icon', url: '/favicon.ico' },
    { rel: 'apple-touch-icon', url: '/logos/apple-touch-icon.png' },
  ],
  openGraph: {
    title: 'GridMenu – Digital QR Code Menus for Restaurants',
    description: 'Turn your existing paper menu into a mobile-friendly QR code menu in minutes. No tech skills required.',
    url: siteUrl,
    type: 'website',
    siteName: 'GridMenu',
    images: [
      {
        url: '/logos/social-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'GridMenu hero preview',
      },
      {
        url: '/logos/logo-1600.png',
        width: 1600,
        height: 1600,
        alt: 'GridMenu brand mark',
      },
      {
        url: '/logos/logo-800.png',
        width: 800,
        height: 800,
        alt: 'GridMenu brand mark (800x800)',
      },
      {
        url: '/logos/logo-400.png',
        width: 400,
        height: 400,
        alt: 'GridMenu brand mark (400x400)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GridMenu – Digital QR Code Menus for Restaurants',
    description: 'Turn your existing paper menu into a mobile-friendly QR code menu in minutes.',
    images: ['/logos/social-1200x630.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* PWA meta tags */}
        <meta name="application-name" content="GridMenu" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GridMenu" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Performance hints */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://uztyljbiqyrykzwtdbpa.supabase.co" />
      </head>
      <body className="min-h-screen bg-white font-sans antialiased">
        <ToastProvider>
          <div id="root" className="relative flex min-h-screen flex-col">
            {children}
          </div>
          <ConsentBanner />
        </ToastProvider>
      </body>
    </html>
  )
}