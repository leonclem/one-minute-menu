import type { Metadata } from 'next'
import ArticleAiNativeSoftware from './ArticleAiNativeSoftware'
import { withIndexableRobots } from '@/lib/studio/public-seo'

export const metadata: Metadata = withIndexableRobots({
  title: "AI-Native Software Shouldn't Look Like a Chatbot | GridMenu",
  description:
    'When teams keep rewriting the same AI prompt, the interface should change. AI-native software hides that prompt behind controls the user already understands.',
  keywords: [
    'AI-native software',
    'AI chatbot interface',
    'prompt fatigue',
    'generative UI',
    'AI food photography',
  ],
  openGraph: {
    title: "AI-Native Software Shouldn't Look Like a Chatbot | GridMenu",
    description:
      'Repeated prompts are a sign the interface should change. Hide the model instructions behind controls.',
    type: 'article',
    url: '/blog/ai-native-software-shouldnt-look-like-a-chatbot',
    images: [
      {
        url: '/backgrounds/ai-native-software-shouldnt-look-like-a-chatbot.jpg',
        width: 1264,
        height: 671,
        alt: 'A chat thread of image-edit requests beside GridMenu controls on a photo of baked salmon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/backgrounds/ai-native-software-shouldnt-look-like-a-chatbot.jpg'],
  },
})

export default function AiNativeSoftwarePage() {
  return <ArticleAiNativeSoftware />
}
