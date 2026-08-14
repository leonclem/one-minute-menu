import type { Metadata } from 'next'
import { parkedPageRobots } from '@/lib/studio/public-seo'

export const metadata: Metadata = {
  robots: parkedPageRobots(),
}

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children
}
