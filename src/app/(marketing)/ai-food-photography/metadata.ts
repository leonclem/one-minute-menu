import type { Metadata } from 'next'
import { withIndexableRobots } from '@/lib/studio/public-seo'
import {
  AI_FOOD_PHOTOGRAPHY_CANONICAL,
  AI_FOOD_PHOTOGRAPHY_DESCRIPTION,
  AI_FOOD_PHOTOGRAPHY_TITLE,
} from './copy'

export function getAiFoodPhotographyMetadata(): Metadata {
  return withIndexableRobots({
    title: AI_FOOD_PHOTOGRAPHY_TITLE,
    description: AI_FOOD_PHOTOGRAPHY_DESCRIPTION,
    alternates: {
      canonical: AI_FOOD_PHOTOGRAPHY_CANONICAL,
    },
    openGraph: {
      title: AI_FOOD_PHOTOGRAPHY_TITLE,
      description: AI_FOOD_PHOTOGRAPHY_DESCRIPTION,
      type: 'website',
      url: AI_FOOD_PHOTOGRAPHY_CANONICAL,
      images: [
        {
          url: '/logos/social-1200x630.png',
          width: 1200,
          height: 630,
          alt: 'GridMenu AI food photography from a real dish photo',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: AI_FOOD_PHOTOGRAPHY_TITLE,
      description: AI_FOOD_PHOTOGRAPHY_DESCRIPTION,
      images: ['/logos/social-1200x630.png'],
    },
  })
}
