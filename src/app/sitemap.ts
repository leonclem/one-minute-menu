import type { MetadataRoute } from 'next'
import { isStudioPublicSurface } from '@/lib/product-mode'

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.ai').replace(/\/$/, '')
  const studioPublic = isStudioPublicSurface()
  const paths = studioPublic
    ? ['/', '/pricing', '/register', '/support', '/privacy', '/terms']
    : ['/', '/pricing', '/demo/sample', '/register', '/support', '/privacy', '/terms']

  return paths.map((path) => ({
    url: path === '/' ? `${site}/` : `${site}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : path === '/pricing' ? 0.8 : 0.5,
  }))
}
