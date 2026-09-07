'use client'

import { useEffect, useState } from 'react'

interface StudioTextModalProps {
  open: boolean
  title: string
  label: string
  helperText?: string
  initialValue?: string
  confirmText?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function StudioTextModal({
  open,
  title,
  label,
  helperText,
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
        className="w-full max-w-sm overflow-hidden rounded-[16px] border border-[var(--studio-border,rgba(255,255,255,0.1))] bg-[var(--studio-panel,#0f1c1f)] shadow-lg"
      >
        <div className="border-b border-[var(--studio-border,rgba(255,255,255,0.1))] px-4 py-3">
          <h3 id="studio-text-modal-title" className="font-bold text-[var(--studio-heading,#fff)]">
            {title}
          </h3>
        </div>
        <div className="px-4 py-3">
          <label
            htmlFor="studio-text-modal-input"
            className="mb-1 block text-sm font-semibold text-[var(--studio-muted-strong,rgba(255,255,255,0.66))]"
          >
            {label}
          </label>
          <input
            id="studio-text-modal-input"
            autoFocus
            type="text"
            value={value}
            aria-describedby={helperText ? 'studio-text-modal-helper' : undefined}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed) onConfirm(trimmed)
              if (e.key === 'Escape') onCancel()
            }}
            className="w-full rounded-[9px] border border-[var(--studio-border-strong,rgba(255,255,255,0.16))] bg-black/20 px-3 py-2 text-sm text-[var(--studio-text,#eef4f4)] focus:border-[#01b3bf] focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/30"
          />
          {helperText ? (
            <p
              id="studio-text-modal-helper"
              className="mt-2 text-xs leading-5 text-[var(--studio-muted-soft,rgba(255,255,255,0.4))]"
            >
              {helperText}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--studio-border,rgba(255,255,255,0.1))] px-4 py-3">
          <button
            type="button"
            className="rounded-[9px] border border-[var(--studio-border-strong,rgba(255,255,255,0.16))] bg-transparent px-3 py-2 text-sm text-[var(--studio-muted-strong,rgba(255,255,255,0.66))] hover:bg-white/5"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!trimmed}
            className="rounded-[9px] bg-[#01b3bf] px-3 py-2 text-sm font-bold text-white hover:bg-[#018f99] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onConfirm(trimmed)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
