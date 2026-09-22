'use client'

import { useCallback, useState } from 'react'

import {
  StudioGuestSignupModal,
  trackGuestAuthGateShown,
  type StudioGuestSignupIntent,
} from './studio-guest-signup-modal'

export function useGuestSignupGate(enabled: boolean) {
  const [open, setOpen] = useState(false)
  const [intent, setIntent] = useState<StudioGuestSignupIntent>('generate')
  const [redirectTo, setRedirectTo] = useState('')

  const requestSignup = useCallback(
    async (nextIntent: StudioGuestSignupIntent) => {
      if (!enabled) return false
      const res = await fetch('/api/studio/guest/session', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as { claimToken?: string } | null
      const claim = data?.claimToken
      const nextPath = `${window.location.pathname}${window.location.search}`
      const callback = new URL('/auth/callback', window.location.origin)
      callback.searchParams.set('next', nextPath)
      if (claim) callback.searchParams.set('claim', claim)
      setIntent(nextIntent)
      setRedirectTo(callback.toString())
      setOpen(true)
      trackGuestAuthGateShown(nextIntent)
      return true
    },
    [enabled],
  )

  const modal = (
    <StudioGuestSignupModal
      open={open}
      intent={intent}
      redirectTo={redirectTo}
      onClose={() => setOpen(false)}
    />
  )

  return { requestSignup, modal }
}
