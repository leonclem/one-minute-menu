export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'

import { StudioGateNotices, StudioShell } from './_components/studio-shell'
import { loadStudioPageSession } from '@/lib/studio/studio-page-session'
import './studio-tokens.css'

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await loadStudioPageSession()
  const isEditor = session.gate === 'editor'

  return (
    <div className="min-h-screen bg-[#0c1416]">
      <StudioShell creditBalance={session.creditBalance} showCredits={isEditor}>
        {isEditor ? children : <StudioGateNotices session={session} />}
      </StudioShell>
    </div>
  )
}
