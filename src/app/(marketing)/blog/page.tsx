import type { Metadata } from 'next'
import BlogPageContent from './BlogPageContent'
import { withParkedRobots } from '@/lib/studio/public-seo'

export const metadata: Metadata = withParkedRobots({
  title: 'Blog | GridMenu',
  description:
    'Archived notes for food and beverage operators. These articles are not current GridMenu product guides.',
  openGraph: {
    title: 'Blog | GridMenu',
    description:
      'Archived notes for food and beverage operators. These articles are not current GridMenu product guides.',
    type: 'website',
    url: '/blog',
    images: [
      {
        url: '/logos/social-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'GridMenu Blog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/logos/social-1200x630.png'],
  },
})

export default function BlogPage() {
  return <BlogPageContent />
}
