export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { Suspense } from 'react'

import { StudioGateNotices, StudioShell } from './_components/studio-shell'
import { StudioGuestBootstrap } from './_components/studio-guest-bootstrap'
import { StudioGuestClaimedBeacon } from './_components/studio-guest-claimed-beacon'
import { loadStudioPageSession } from '@/lib/studio/studio-page-session'
import './studio-tokens.css'

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await loadStudioPageSession()
  const isEditor = session.gate === 'editor'

  return (
    <div className="min-h-screen bg-[#0c1416]">
      <StudioShell
        creditBalance={session.creditBalance}
        showCredits={isEditor && !session.isGuest}
        userEmail={session.email}
        isGuest={session.isGuest}
      >
        <Suspense fallback={null}>
          <StudioGuestClaimedBeacon />
        </Suspense>
        {session.gate === 'guest_bootstrap' ? (
          <StudioGuestBootstrap />
        ) : isEditor ? (
          children
        ) : (
          <StudioGateNotices session={session} />
        )}
      </StudioShell>
    </div>
  )
}
