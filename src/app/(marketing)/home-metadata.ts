import type { Metadata } from 'next'
import { isStudioPublicSurface } from '@/lib/product-mode'
import { STUDIO_SEO, studioOpenGraph } from '@/lib/studio/public-seo'

const MENU_HOME_METADATA: Metadata = {
  title: 'Restaurant Menu Maker | Digital & Print-ready Menus | GridMenu',
  description:
    'Create a restaurant menu online in minutes with GridMenu. Add dishes and prices, choose a style, and generate polished digital or PDF-ready menus with AI food photos.',
  openGraph: {
    title: 'Restaurant Menu Maker | Digital & Print-ready Menus | GridMenu',
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

export function getHomePageMetadata(): Metadata {
  if (!isStudioPublicSurface()) return MENU_HOME_METADATA
  return {
    title: STUDIO_SEO.title,
    description: STUDIO_SEO.description,
    openGraph: studioOpenGraph(),
    twitter: {
      card: 'summary_large_image',
      title: STUDIO_SEO.title,
      description: STUDIO_SEO.description,
      images: ['/logos/social-1200x630.png'],
    },
  }
}

export const metadata = getHomePageMetadata()
