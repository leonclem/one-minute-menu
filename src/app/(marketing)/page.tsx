import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import HomePageContent from './HomePageContent'

export const metadata: Metadata = {
  title: 'Restaurant Menu Maker | Create a Digital Menu in Minutes | GridMenu',
  description:
    'Create a restaurant menu online in minutes with GridMenu. Add dishes and prices, choose a style, and generate polished digital or PDF-ready menus with AI food photos.',
  openGraph: {
    title: 'Restaurant Menu Maker | Create a Digital Menu in Minutes | GridMenu',
    description:
      'Create a restaurant menu online in minutes with GridMenu. Add dishes and prices, choose a style, and generate polished digital or PDF-ready menus with AI food photos.',
    type: 'website',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.ai',
    images: [
      {
        url: '/logos/social-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'GridMenu — restaurant menu maker for digital and PDF-ready menus',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/logos/social-1200x630.png'],
  },
}

export default async function HomePage() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <HomePageContent initialUser={user} />
}
