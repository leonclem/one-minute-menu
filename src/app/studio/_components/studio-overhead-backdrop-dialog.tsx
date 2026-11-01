'use client'

interface StudioOverheadBackdropDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function StudioOverheadBackdropDialog({
  open,
  onConfirm,
  onCancel,
}: StudioOverheadBackdropDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-overhead-backdrop-title"
        aria-describedby="studio-overhead-backdrop-description"
        className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="border-b px-4 py-3">
          <h2 id="studio-overhead-backdrop-title" className="font-medium text-gray-900">
            Backdrop will be unselected
          </h2>
        </div>
        <div className="px-4 py-4">
          <p id="studio-overhead-backdrop-description" className="text-sm leading-6 text-gray-700">
            Switching to overhead removes the backdrop you selected. An overhead shot looks
            straight down, so there is no wall behind the dish.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t bg-gray-50/50 px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
          >
            Keep backdrop
          </button>
          <button
            type="button"
            className="rounded-md bg-ux-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            onClick={onConfirm}
          >
            Switch to overhead
          </button>
        </div>
      </div>
    </div>
  )
}
