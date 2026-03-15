import type { Metadata } from 'next'
import ArticleDigitalVsPaper from './ArticleDigitalVsPaper'

export const metadata: Metadata = {
  title: 'Paper Menus for Guests, Digital Control for Operators | GridMenu',
  description:
    'Are paper menus still better for restaurants? This guide explores paper vs digital menus, what diners prefer, and why many operators now need both.',
  keywords: [
    'digital vs paper menu',
    'paper vs digital menus',
    'restaurant digital menu',
    'printed menu vs QR menu',
    'menu design for restaurants',
    'restaurant menu strategy',
    'Singapore restaurant digital ordering',
  ],
  openGraph: {
    title: 'Paper Menus for Guests, Digital Control for Operators | GridMenu',
    description:
      'Printed menus still matter in hospitality, but digital control helps restaurants update faster and operate more efficiently.',
    type: 'article',
    url: '/blog/digital-vs-paper-menus',
    images: [
      {
        url: '/logos/social-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'Paper Menus for Guests, Digital Control for Operators',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/logos/social-1200x630.png'],
  },
}

export default function DigitalVsPaperMenusPage() {
  return <ArticleDigitalVsPaper />
}
