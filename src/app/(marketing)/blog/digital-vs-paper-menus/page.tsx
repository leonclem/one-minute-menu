import type { Metadata } from 'next'
import ArticleDigitalVsPaper from './ArticleDigitalVsPaper'
import { withParkedRobots } from '@/lib/studio/public-seo'

export const metadata: Metadata = withParkedRobots({
  title: 'Paper Menus for Guests, Digital Control for Operators | GridMenu',
  description:
    'Are paper menus still better for restaurants? This guide explores paper vs digital menus, what diners prefer, and why many operators now need both.',
  openGraph: {
    title: 'Paper Menus for Guests, Digital Control for Operators | GridMenu',
    description:
      'Printed menus still matter in hospitality, but digital control helps restaurants update faster and operate more efficiently.',
    type: 'article',
    url: '/blog/digital-vs-paper-menus',
    images: [
      {
        url: '/backgrounds/restaurant-scene-with-menu.png',
        width: 1200,
        height: 630,
        alt: 'Paper Menus for Guests, Digital Control for Operators',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/backgrounds/restaurant-scene-with-menu.png'],
  },
})

export default function DigitalVsPaperMenusPage() {
  return <ArticleDigitalVsPaper />
}
