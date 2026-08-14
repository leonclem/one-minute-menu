import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { parkedPageRobots } from '@/lib/studio/public-seo'

export const metadata: Metadata = {
  robots: parkedPageRobots(),
}

const DemoSampleClient = dynamic(() => import('./demo-sample-client'), {
  ssr: false,
})

export default function UXDemoSamplePage() {
  return <DemoSampleClient />
}