'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui'

interface BulkDeleteModalProps {
  itemCount: number
  menuId: string
  selectedItemIds: string[]
  onClose: () => void
  onItemsDeleted: () => void
}

export default function BulkDeleteModal({
  itemCount,
  menuId,
  selectedItemIds,
  onClose,
  onItemsDeleted
}: BulkDeleteModalProps) {
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const handleBulkDelete = async () => {
    setLoading(true)
    try {
      console.log('Bulk deleting items:', { menuId, selectedItemIds })
      const response = await fetch(`/api/menus/${menuId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedItemIds }),
      })
      
      if (!response.ok) {
        let errorMessage = 'Failed to delete items'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch {
          // If response is not JSON (e.g., HTML error page), use status text
          errorMessage = `${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      showToast({
        type: 'success',
        title: 'Items deleted',
        description: `${itemCount} item${itemCount === 1 ? '' : 's'} have been removed from your menu.`,
      })
      
      onItemsDeleted()
      onClose()
    } catch (error) {
      console.error('Error deleting items:', error)
      showToast({
        type: 'error',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg border border-ux-border">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-ux-text mb-2">
            Delete Selected Items
          </h3>
          <p className="text-ux-text-secondary mb-4">
            Are you sure you want to delete {itemCount} selected item{itemCount === 1 ? '' : 's'}? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              {loading ? 'Deleting...' : `Delete ${itemCount} Item${itemCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}