'use client'

import { useEffect, useState } from 'react'

interface StudioTextModalProps {
  open: boolean
  title: string
  label: string
  initialValue?: string
  confirmText?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function StudioTextModal({
  open,
  title,
  label,
  initialValue = '',
  confirmText = 'Save',
  onConfirm,
  onCancel,
}: StudioTextModalProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  if (!open) return null

  const trimmed = value.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-text-modal-title"
        className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg"
      >
        <div className="border-b px-4 py-3">
          <h3 id="studio-text-modal-title" className="font-medium text-gray-900">
            {title}
          </h3>
        </div>
        <div className="px-4 py-3">
          <label className="block text-sm text-gray-700">
            <span className="mb-1 block font-medium">{label}</span>
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmed) onConfirm(trimmed)
                if (e.key === 'Escape') onCancel()
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ux-primary focus:outline-none focus:ring-2 focus:ring-ux-primary/30"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t bg-gray-50/50 px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!trimmed}
            className="rounded-md bg-ux-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onConfirm(trimmed)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
