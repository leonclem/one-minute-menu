import type { Metadata } from 'next'
import ArticleInflation from './ArticleInflation'

export const metadata: Metadata = {
  title: 'Restaurants Cannot Control Inflation. They Can Control This | GridMenu',
  description:
    'Restaurants cannot control inflation or supplier volatility, but they can control how quickly they respond. Here is why menu agility matters more than ever.',
  keywords: [
    'restaurant inflation',
    'menu pricing strategy',
    'restaurant cost management',
    'menu workflow',
    'food price increases',
    'restaurant operations',
    'menu agility',
  ],
  openGraph: {
    title: 'Restaurants Cannot Control Inflation. They Can Control This | GridMenu',
    description:
      'Restaurants cannot control inflation or supplier volatility, but they can control how quickly they respond. Here is why menu agility matters more than ever.',
    type: 'article',
    url: '/blog/restaurants-cannot-control-inflation',
    images: [
      {
        url: '/backgrounds/ship-on-rough-sea-foreshadow.png',
        width: 1200,
        height: 630,
        alt: 'Restaurants Cannot Control Inflation. They Can Control This',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/backgrounds/ship-on-rough-sea-foreshadow.png'],
  },
}

export default function RestaurantsInflationPage() {
  return <ArticleInflation />
}
