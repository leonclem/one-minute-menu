"use client"

import React from 'react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'primary' | 'danger'
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'primary',
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className={`font-medium ${variant === 'danger' ? 'text-red-900' : 'text-secondary-900'}`}>{title}</h3>
        </div>
        <div className="px-4 py-3 text-sm text-secondary-700">
          {description}
        </div>
        <div className="px-4 py-3 border-t flex justify-end gap-2 bg-gray-50/50">
          {cancelText && (
            <button
              className="px-3 py-2 text-sm rounded-md border border-secondary-300 text-secondary-700 bg-white hover:bg-secondary-50"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button
            className={`px-3 py-2 text-sm rounded-md text-white shadow-sm ${
              variant === 'danger' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}


