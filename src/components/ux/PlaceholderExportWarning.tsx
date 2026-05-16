'use client'

import React, { useState } from 'react'
import { UXButton } from './UXButton'

const LS_KEY_HIDE_EXPORT_WARNING = 'gridmenu:hidePlaceholderExportWarning'

interface PlaceholderExportWarningProps {
  open: boolean
  onProceed: () => void
  onCancel: () => void
}

export function PlaceholderExportWarning({
  open,
  onProceed,
  onCancel,
}: PlaceholderExportWarningProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  if (!open) return null

  const handleProceed = () => {
    if (dontShowAgain) {
      localStorage.setItem(LS_KEY_HIDE_EXPORT_WARNING, 'true')
    }
    onProceed()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Sample items included
            </h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Your menu still contains sample placeholder items. These will
            appear in the exported file with a &quot;SAMPLE&quot; watermark.
          </p>
        </div>

        <div className="px-6 pb-4 flex gap-3">
          <UXButton
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={onCancel}
          >
            Go back
          </UXButton>
          <UXButton
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={handleProceed}
          >
            Export anyway
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
  )
}

/** Check if the export warning has been permanently dismissed. */
export function isExportWarningDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_KEY_HIDE_EXPORT_WARNING) === 'true'
}
