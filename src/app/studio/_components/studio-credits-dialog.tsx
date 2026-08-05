'use client'

interface StudioCreditsDialogProps {
  open: boolean
  onClose: () => void
}

export function StudioCreditsDialog({ open, onClose }: StudioCreditsDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-credits-dialog-title"
        aria-describedby="studio-credits-dialog-description"
        className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="border-b px-4 py-3">
          <h2 id="studio-credits-dialog-title" className="font-medium text-gray-900">
            Generation unavailable
          </h2>
        </div>
        <div className="px-4 py-4">
          <p id="studio-credits-dialog-description" className="text-sm leading-6 text-gray-700">
            Not enough credits to generate. Ask an admin for a grant.
          </p>
        </div>
        <div className="flex justify-end border-t bg-gray-50/50 px-4 py-3">
          <button
            type="button"
            autoFocus
            className="rounded-md bg-ux-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
