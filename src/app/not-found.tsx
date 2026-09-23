import type { Metadata } from 'next'

import { NotFoundPanel } from '@/components/not-found-panel'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <NotFoundPanel
      title="Page not found"
      description="This page does not exist, or it is no longer available."
      actions={[{ href: '/', label: 'Go home' }]}
    />
  )
}
