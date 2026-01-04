'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import type { MenuItem } from '@/types'

interface MenuItemActionsModalProps {
  item: MenuItem
  menuId: string
  availableCategories: string[]
  onClose: () => void
  onItemUpdated: () => void
  onManageImages?: () => void
  onEditDetails?: () => void
}

export default function MenuItemActionsModal({
  item,
  menuId,
  availableCategories,
  onClose,
  onItemUpdated,
  onManageImages,
  onEditDetails
}: MenuItemActionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const handleDeleteItem = async () => {
    setLoading(true)
    try {
      console.log('Deleting item:', { menuId, itemId: item.id })
      const response = await fetch(`/api/menus/${menuId}/items/${item.id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        let errorMessage = 'Failed to delete item'
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
        title: 'Item deleted',
        description: `"${item.name}" has been removed from your menu.`,
      })
      
      onItemUpdated()
      onClose()
    } catch (error) {
      console.error('Error deleting item:', error)
      showToast({
        type: 'error',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAvailability = async () => {
    setLoading(true)
    try {
      const newAvailability = !item.available
      const response = await fetch(`/api/menus/${menuId}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: newAvailability }),
      })
      
      if (!response.ok) {
        let errorMessage = 'Failed to update item'
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
        title: newAvailability ? 'Item marked available' : 'Item marked out of stock',
        description: `"${item.name}" is now ${newAvailability ? 'available' : 'out of stock'}.`,
      })
      
      onItemUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating item availability:', error)
      showToast({
        type: 'error',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMoveToCategory = async (newCategory: string) => {
    if (newCategory === item.category) {
      onClose()
      return
    }

    setLoading(true)
    try {
      console.log('Moving item to category:', { menuId, itemId: item.id, newCategory })
      const response = await fetch(`/api/menus/${menuId}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      })
      
      if (!response.ok) {
        let errorMessage = 'Failed to move item'
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
        title: 'Item moved',
        description: `"${item.name}" has been moved to ${newCategory}.`,
      })
      
      onItemUpdated()
      onClose()
    } catch (error) {
      console.error('Error moving item:', error)
      showToast({
        type: 'error',
        title: 'Move failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  if (showDeleteConfirm) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg border border-ux-border">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-ux-text mb-2">
              Delete Menu Item
            </h3>
            <p className="text-ux-text-secondary mb-4">
              Are you sure you want to delete "{item.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteItem}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                {loading ? 'Deleting...' : 'Delete Item'}
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // Filter out current category from available categories
  const otherCategories = availableCategories.filter(cat => cat !== item.category)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg border border-ux-border">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-ux-text mb-1">
            {item.name}
          </h3>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm text-ux-text-secondary">
              Choose an action for this menu item
            </p>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              item.available 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {item.available ? 'Available' : 'Out of Stock'}
            </span>
          </div>
          
          <div className="space-y-2">
            {/* Edit details */}
            {onEditDetails && (
              <button
                onClick={() => {
                  onEditDetails()
                  onClose()
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-ux-background-secondary transition-colors text-ux-text disabled:opacity-50"
              >
                Update item details
              </button>
            )}

            {/* Manage images */}
            {onManageImages && (
              <button
                onClick={() => {
                  onManageImages()
                  onClose()
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-ux-background-secondary transition-colors text-ux-text disabled:opacity-50"
              >
                Manage photos & images
              </button>
            )}
            
            {/* Toggle availability */}
            <button
              onClick={handleToggleAvailability}
              disabled={loading}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-ux-background-secondary transition-colors text-ux-text disabled:opacity-50"
            >
              {item.available ? 'Mark as out of stock' : 'Mark as available'}
            </button>
            
            {/* Move to category */}
            {otherCategories.length > 0 && (
              <div className="border-t border-ux-border pt-2">
                <p className="text-xs font-medium text-ux-text-secondary mb-2 px-3">
                  Move to category:
                </p>
                {otherCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleMoveToCategory(category)}
                    disabled={loading}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-ux-background-secondary transition-colors text-ux-text disabled:opacity-50"
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
            
            {/* Delete item */}
            <div className="border-t border-ux-border pt-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-red-600 disabled:opacity-50"
              >
                Delete item entirely
              </button>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-ux-border">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}