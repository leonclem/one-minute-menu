'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { UXButton } from './UXButton'

const LS_KEY_HIDE_POPUP = 'gridmenu:hidePlaceholderPopup'

interface PlaceholderItemsDialogProps {
  open: boolean
  onKeepSamples: () => void
}

export function PlaceholderItemsDialog({
  open,
  onKeepSamples,
}: PlaceholderItemsDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  if (!open) return null

  const handleKeepSamples = () => {
    if (dontShowAgain) {
      localStorage.setItem(LS_KEY_HIDE_POPUP, 'true')
    }
    onKeepSamples()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Sample items added
              </h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              We&apos;ve added sample items to bring your menu preview to life.
              Feel free to click around, explore layouts and styles. These items
              won&apos;t appear in your final menu unless you choose to keep them.
            </p>
          </div>

          <div className="px-6 pb-4">
            <UXButton
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleKeepSamples}
            >
              Use these as a starting point
            </UXButton>
          </div>

          <div className="px-6 pb-5">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded text-ux-primary focus:ring-ux-primary h-4 w-4"
              />
              <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                Don&apos;t show this again
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Check if the user has dismissed the placeholder popup permanently. */
export function isPlaceholderPopupDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_KEY_HIDE_POPUP) === 'true'
}
