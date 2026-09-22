'use client'

import { AuthOTPForm } from '@/components/auth/AuthOTPForm'
import { ANALYTICS_EVENTS, captureEvent } from '@/lib/posthog'
import { trackConversionEvent } from '@/lib/conversion-tracking'

export type StudioGuestSignupIntent = 'generate' | 'expand' | 'remove' | 'elements_analysis' | 'crop'

const TITLES: Record<StudioGuestSignupIntent, string> = {
  generate: 'Create a free account to generate',
  expand: 'Create a free account to expand this shot',
  remove: 'Create a free account to remove objects',
  elements_analysis: 'Create a free account to analyse this dish',
  crop: 'Create a free account to crop more variants',
}

interface StudioGuestSignupModalProps {
  open: boolean
  intent: StudioGuestSignupIntent
  redirectTo: string
  onClose: () => void
}

export function StudioGuestSignupModal({
  open,
  intent,
  redirectTo,
  onClose,
}: StudioGuestSignupModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-guest-signup-title"
        className="w-full max-w-md overflow-hidden rounded-[16px] border border-white/10 bg-[#0f1c1f] shadow-xl"
        data-testid="studio-guest-signup-modal"
      >
        <div className="border-b border-white/10 px-5 py-3">
          <h2 id="studio-guest-signup-title" className="text-base font-bold text-white">
            {TITLES[intent]}
          </h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/studio/lighting/lighting-bright-clean.png"
              alt=""
              className="h-24 w-full rounded-[11px] object-cover"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/studio/lighting/lighting-golden-hour.png"
              alt=""
              className="h-24 w-full rounded-[11px] object-cover"
            />
          </div>
          <p className="text-center text-[11px] font-bold uppercase tracking-wider text-white/40">
            Before · Studio look
          </p>
          <p className="text-sm leading-6 text-white/70">
            Your lighting, surface, and backdrop choices are saved. New accounts start with 10
            credits. We will bring you back here after you click the email link.
          </p>
          <AuthOTPForm
            type="signup"
            title="Sign up with email"
            subtitle="We will send a magic link. Your work stays in Studio."
            buttonText="Send magic link"
            redirectTo={redirectTo}
            trackingSource="studio_guest_gate"
            onSuccess={() => {
              void fetch('/api/studio/guest/session', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ magicLinkSent: true, pendingAction: { intent } }),
              })
            }}
          />
          <a
            href={`/register?next=${encodeURIComponent(redirectTo)}`}
            className="block text-center text-sm font-semibold text-white/45 hover:text-white"
          >
            Open the full signup page
          </a>
        </div>
        <div className="flex justify-end border-t border-white/10 px-5 py-3">
          <button
            type="button"
            className="text-sm font-semibold text-white/55 hover:text-white"
            onClick={onClose}
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  )
}

export function trackGuestAuthGateShown(intent: StudioGuestSignupIntent): void {
  trackConversionEvent({
    event: 'registration_start',
    metadata: { path: '/studio', source: 'studio_guest_gate', intent },
  })
  captureEvent(ANALYTICS_EVENTS.STUDIO_AUTH_GATE_SHOWN, { intent })
}
