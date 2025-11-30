"use client"

import React from 'react'

interface DeleteMenuDialogProps {
  open: boolean
  menuName: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Delete Menu Confirmation Dialog
 * 
 * Displays a confirmation dialog when a user attempts to delete a menu.
 * Warns the user that the action cannot be undone.
 * 
 * Requirements: 1.2
 * - Display confirmation dialog with warning message
 * - Show "This action cannot be undone" warning
 * - Provide cancel and confirm buttons
 */
export function DeleteMenuDialog({
  open,
  menuName,
  onConfirm,
  onCancel,
}: DeleteMenuDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        {/* Header with warning icon */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg 
                className="w-6 h-6 text-red-600" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Menu?</h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-700 mb-3">
            Are you sure you want to delete <span className="font-semibold">"{menuName}"</span>?
          </p>
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800 font-medium">
              ⚠️ This action cannot be undone
            </p>
            <p className="text-xs text-red-700 mt-1">
              All menu items and associated data will be permanently removed.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            onClick={onConfirm}
          >
            Delete Menu
          </button>
        </div>
      </div>
    </div>
  )
}
