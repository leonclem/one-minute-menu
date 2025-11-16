'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getStoredConsent, saveConsent } from '@/lib/consent'

type BannerState = 'hidden' | 'visible'

export function ConsentBanner() {
  const [state, setState] = useState<BannerState>('hidden')

  useEffect(() => {
    // Only show banner if no consent has been recorded yet
    const prefs = getStoredConsent()
    if (!prefs) {
      setState('visible')
    }
  }, [])

  if (state !== 'visible') {
    return null
  }

  const handleChoice = (analytics: boolean) => {
    saveConsent({ analytics })
    setState('hidden')
  }

  return (
    <div
      role="dialog"
      aria-label="Privacy and cookie settings"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm"
    >
      <div className="container-ux py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-medium text-slate-900">
              We value your privacy
            </p>
            <p className="text-slate-600">
              GridMenu uses essential cookies to keep you signed in and privacy-friendly analytics to improve the product. You can choose whether to enable analytics.
            </p>
            <p className="text-xs text-slate-500">
              Read our{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-700">
                Privacy Policy
              </Link>{' '}
              for details.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => handleChoice(false)}
            >
              Decline analytics
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-[rgb(var(--ux-primary))] px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-[rgb(var(--ux-primary-dark))]"
              onClick={() => handleChoice(true)}
            >
              Allow analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


