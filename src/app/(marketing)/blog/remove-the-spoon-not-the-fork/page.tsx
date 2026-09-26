import type { Metadata } from 'next'
import ArticleRemoveTheSpoon from './ArticleRemoveTheSpoon'
import { withIndexableRobots } from '@/lib/studio/public-seo'

export const metadata: Metadata = withIndexableRobots({
  title: 'Remove the Spoon, Not the Fork | GridMenu',
  description:
    'AI food photo editing still starts with a blank prompt. Photographers end up negotiating over a spoon and a fork. GridMenu replaces that with controls.',
  openGraph: {
    title: 'Remove the Spoon, Not the Fork | GridMenu',
    description:
      'Why AI image editing needs controls, not better prompts. Keep the dish the same without sitting in a chat box.',
    type: 'article',
    url: '/blog/remove-the-spoon-not-the-fork',
    images: [
      {
        url: '/backgrounds/remove-the-spoon-not-the-fork.png',
        width: 1200,
        height: 630,
        alt: 'Remove the Spoon, Not the Fork',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/backgrounds/remove-the-spoon-not-the-fork.png'],
  },
})

export default function RemoveTheSpoonNotTheForkPage() {
  return <ArticleRemoveTheSpoon />
}
