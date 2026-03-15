import type { Metadata } from 'next'
import BlogPageContent from './BlogPageContent'

export const metadata: Metadata = {
  title: 'Blog | GridMenu',
  description:
    'Tips, insights, and guides for food & beverage businesses looking to create better digital menus and grow their online presence.',
  keywords: [
    'restaurant blog',
    'digital menu tips',
    'food business advice',
    'restaurant marketing',
    'GridMenu blog',
  ],
  openGraph: {
    title: 'Blog | GridMenu',
    description:
      'Tips, insights, and guides for food & beverage businesses looking to create better digital menus and grow their online presence.',
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
}

export default function BlogPage() {
  return <BlogPageContent />
}
