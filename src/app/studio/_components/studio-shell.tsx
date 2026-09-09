import type { ReactNode } from 'react'

import { PendingApproval } from '@/components/dashboard/PendingApproval'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import type { AccessMode } from '@/lib/studio/access/studio-access-mode'
import type { StudioPageSession } from '@/lib/studio/studio-page-session'

import { StudioAccessDeniedTracker } from './studio-access-denied-tracker'
import { StudioAppBar } from './studio-app-bar'
import { StudioCreditsProvider } from './studio-credits-context'
import { StudioSignupBeacon } from './studio-signup-beacon'
import { StudioStateNotice } from './studio-state-notice'

function PendingInviteNotice({
  accessMode,
  accessReason,
  isAdmin,
}: {
  accessMode: AccessMode
  accessReason: Extract<StudioAccessReason, 'denied_admin_only' | 'denied_beta_access_required'>
  isAdmin: boolean
}) {
  return (
    <>
      <StudioAccessDeniedTracker
        accessMode={accessMode}
        accessReason={accessReason}
        isAdmin={isAdmin}
        gallerySize={0}
      />
      <StudioStateNotice kind="pending_access" />
    </>
  )
}

export function StudioGateNotices({ session }: { session: StudioPageSession }) {
  if (session.gate === 'waitlist') {
    return <PendingApproval email={session.email} />
  }

  if (session.gate === 'disabled') {
    return (
      <>
        <StudioAccessDeniedTracker
          accessMode={session.accessMode}
          accessReason="denied_studio_disabled"
          isAdmin={session.isAdmin}
          gallerySize={0}
        />
        <StudioStateNotice kind="disabled" />
      </>
    )
  }

  const inviteReason =
    session.accessReason === 'denied_beta_access_required'
      ? 'denied_beta_access_required'
      : 'denied_admin_only'
  return (
    <PendingInviteNotice
      accessMode={session.accessMode}
      accessReason={inviteReason}
      isAdmin={session.isAdmin}
    />
  )
}

export function StudioShell({
  children,
  creditBalance,
  showCredits,
  userEmail,
}: {
  children: ReactNode
  creditBalance: number | null
  showCredits: boolean
  userEmail?: string
}) {
  return (
    <StudioCreditsProvider initialBalance={creditBalance}>
      <div className="studio-shell">
        <StudioSignupBeacon />
        <StudioAppBar showCredits={showCredits} userEmail={userEmail} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 md:py-10">{children}</main>
        <footer className="mt-auto border-t border-white/[0.07] px-4 py-4 text-center text-xs text-white/40">
          <a className="studio-link mx-2" href="/privacy">
            Privacy
          </a>
          <a className="studio-link mx-2" href="/terms">
            Terms
          </a>
          <a className="studio-link mx-2" href="/support">
            Support
          </a>
        </footer>
      </div>
    </StudioCreditsProvider>
  )
}
