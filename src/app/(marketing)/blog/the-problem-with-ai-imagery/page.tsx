import type { Metadata } from 'next'
import ArticleWhatNeverExisted from './ArticleWhatNeverExisted'
import { withParkedRobots } from '@/lib/studio/public-seo'

export const metadata: Metadata = withParkedRobots({
  title: "The Problem With AI Imagery Isn't AI. It's What Never Existed | GridMenu",
  description:
    'Some AI food imagery is repellent, but the tool is not the problem. The question is what the image claims to represent, and what we ask AI to invent.',
  openGraph: {
    title: "The Problem With AI Imagery Isn't AI. It's What Never Existed | GridMenu",
    description:
      'The problem is not whether an image used AI. It is whether the image still represents something real.',
    type: 'article',
    url: '/blog/the-problem-with-ai-imagery',
    images: [
      {
        url: '/backgrounds/the-problem-with-ai-imagery.png',
        width: 3490,
        height: 1262,
        alt: 'Left: real banana bread enhanced with AI. Right: an obviously fake banana bread.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/backgrounds/the-problem-with-ai-imagery.png'],
  },
})

export default function TheProblemWithAiImageryPage() {
  return <ArticleWhatNeverExisted />
}
