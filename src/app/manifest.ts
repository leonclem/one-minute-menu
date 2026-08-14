import type { MetadataRoute } from 'next'
import { isStudioPublicSurface } from '@/lib/product-mode'
import { STUDIO_SEO } from '@/lib/studio/public-seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GridMenu',
    short_name: 'GridMenu',
    description: isStudioPublicSurface()
      ? STUDIO_SEO.description
      : 'Create digital menus with QR codes for restaurants',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3B82F6',
    orientation: 'portrait-primary',
    icons: [
      { src: '/logos/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logos/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/logos/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    categories: ['business', 'food', 'productivity'],
    lang: 'en',
    dir: 'ltr',
  }
}
