import type { Metadata } from 'next'

import { NotFoundPanel } from '@/components/not-found-panel'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function StudioNotFound() {
  return (
    <NotFoundPanel
      title="This photo isn't available"
      description="The link may be out of date. You can go home, or open Studio and start from your library."
      actions={[
        { href: '/', label: 'Go home' },
        { href: '/studio', label: 'Open Studio', variant: 'outline' },
      ]}
    />
  )
}
