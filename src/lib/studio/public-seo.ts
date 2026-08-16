import type { Metadata } from 'next'
import { isStudioPublicSurface } from '@/lib/product-mode'

export const STUDIO_SEO = {
  title: 'AI Food Photo Studio | GridMenu',
  description:
    'Turn a real dish photo into polished commercial food images — no prompts. Control lighting, background, and surface. Private beta, invite only.',
  h1: 'Turn your photos into studio-quality images without prompts.',
} as const

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gridmenu.ai'

export function studioOpenGraph(title = STUDIO_SEO.title, description = STUDIO_SEO.description) {
  return {
    title,
    description,
    type: 'website' as const,
    url: siteUrl,
    images: [
      {
        url: '/logos/social-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'GridMenu — AI food photo studio',
      },
    ],
  }
}

export function parkedPageRobots(): Metadata['robots'] | undefined {
  if (!isStudioPublicSurface()) return undefined
  return { index: false, follow: false }
}

export function withParkedRobots(metadata: Metadata): Metadata {
  const robots = parkedPageRobots()
  if (!robots) return metadata
  return { ...metadata, robots }
}
