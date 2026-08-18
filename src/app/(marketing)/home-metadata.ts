import type { Metadata } from 'next'
import { STUDIO_SEO, studioOpenGraph } from '@/lib/studio/public-seo'

export function getHomePageMetadata(): Metadata {
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
