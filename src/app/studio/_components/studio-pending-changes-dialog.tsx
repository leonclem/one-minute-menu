'use client'

import type { Dispatch, SetStateAction } from 'react'

interface StudioPendingChangesDialogProps {
  open: boolean
  maxChanges: number
  changeCount: number
  dontShowAgain: boolean
  onDontShowAgainChange: Dispatch<SetStateAction<boolean>>
  onApplyAnyway: () => void
  onReview: () => void
}

export function StudioPendingChangesDialog({
  open,
  maxChanges,
  changeCount,
  dontShowAgain,
  onDontShowAgainChange,
  onApplyAnyway,
  onReview,
}: StudioPendingChangesDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-pending-changes-title"
        aria-describedby="studio-pending-changes-description"
        className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="border-b px-4 py-3">
          <h3 id="studio-pending-changes-title" className="font-medium text-gray-900">
            More than {maxChanges} changes?
          </h3>
        </div>
        <div className="space-y-4 px-4 py-4">
          <p id="studio-pending-changes-description" className="text-sm leading-6 text-gray-700">
            You&apos;re up to {changeCount} changes for this image. Adding more edits could
            compromise the integrity of the output.
          </p>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => onDontShowAgainChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-ux-primary focus:ring-ux-primary"
            />
            <span>Don&apos;t show again this session</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t bg-gray-50/50 px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onReview}
          >
            Okay, let me review
          </button>
          <button
            type="button"
            className="rounded-md bg-ux-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            onClick={onApplyAnyway}
          >
            Apply anyway
          </button>
        </div>
      </div>
    </div>
  )
}
