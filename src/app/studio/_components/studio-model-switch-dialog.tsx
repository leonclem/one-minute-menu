import type { Dispatch, SetStateAction } from 'react'

interface StudioModelSwitchDialogProps {
  open: boolean
  dontShowAgain: boolean
  nb2Cost: number
  proCost: number
  onDontShowAgainChange: Dispatch<SetStateAction<boolean>>
  onConfirm: () => void
  onCancel: () => void
}

export function StudioModelSwitchDialog({
  open,
  dontShowAgain,
  nb2Cost,
  proCost,
  onDontShowAgainChange,
  onConfirm,
  onCancel,
}: StudioModelSwitchDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-model-switch-title"
        aria-describedby="studio-model-switch-description"
        className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="border-b px-4 py-3">
          <h3 id="studio-model-switch-title" className="font-medium text-gray-900">
            Switch to Nano Banana Pro?
          </h3>
        </div>
        <div className="space-y-4 px-4 py-4">
          <p id="studio-model-switch-description" className="text-sm leading-6 text-gray-700">
            Nano Banana Pro uses more Studio credits per generation ({proCost} vs {nb2Cost} for
            NB2). Use Pro when you need its additional image quality and capability.
          </p>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => onDontShowAgainChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-ux-primary focus:ring-ux-primary"
            />
            <span>Don&apos;t show this again this session</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t bg-gray-50/50 px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
          >
            Stay with NB2
          </button>
          <button
            type="button"
            className="rounded-md bg-ux-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            onClick={onConfirm}
          >
            Switch to Pro
          </button>
        </div>
      </div>
    </div>
  )
}
