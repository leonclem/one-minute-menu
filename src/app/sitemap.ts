import type { MetadataRoute } from 'next'
import { isStudioPublicSurface } from '@/lib/product-mode'

const BLOG_PATHS = [
  '/blog',
  '/blog/the-problem-with-ai-imagery',
  '/blog/remove-the-spoon-not-the-fork',
  '/blog/restaurants-cannot-control-inflation',
  '/blog/digital-vs-paper-menus',
]

function priorityFor(path: string): number {
  if (path === '/') return 1
  if (path === '/pricing') return 0.8
  if (path === '/blog') return 0.7
  if (path.startsWith('/blog/')) return 0.6
  return 0.5
}

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.ai').replace(/\/$/, '')
  const studioPublic = isStudioPublicSurface()
  const paths = [
    ...(studioPublic
      ? ['/', '/pricing', '/register', '/support', '/privacy', '/terms']
      : ['/', '/pricing', '/demo/sample', '/register', '/support', '/privacy', '/terms']),
    ...BLOG_PATHS,
  ]

  return paths.map((path) => ({
    url: path === '/' ? `${site}/` : `${site}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: priorityFor(path),
  }))
}
