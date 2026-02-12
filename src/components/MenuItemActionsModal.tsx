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
  /** All items in the menu, used to check for existing featured items in the same category */
  allItems?: MenuItem[]
  onClose: () => void
  onItemUpdated: () => void
  onManageImages?: () => void
  onEditDetails?: () => void
}

export default function MenuItemActionsModal({
  item,
  menuId,
  availableCategories,
  allItems,
  onClose,
  onItemUpdated,
  onManageImages,
  onEditDetails
}: MenuItemActionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFeaturedConfirm, setShowFeaturedConfirm] = useState<string | null>(null)
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

  const handleToggleFeatured = async (replacingItemId?: string) => {
    setLoading(true)
    try {
      // If replacing another featured item, unfeatured it first
      if (replacingItemId) {
        const unfeatRes = await fetch(`/api/menus/${menuId}/items/${replacingItemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFeatured: false }),
        })
        if (!unfeatRes.ok) {
          throw new Error('Failed to remove featured status from existing item')
        }
      }

      const newFeatured = !item.isFeatured
      const response = await fetch(`/api/menus/${menuId}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: newFeatured }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to update item'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch {
          errorMessage = `${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      showToast({
        type: 'success',
        title: newFeatured ? 'Item featured' : 'Featured removed',
        description: newFeatured
          ? `"${item.name}" will be highlighted on your menu.`
          : `"${item.name}" is no longer featured.`,
      })

      onItemUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating featured status:', error)
      showToast({
        type: 'error',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
      setShowFeaturedConfirm(null)
    }
  }

  const handleFeaturedClick = () => {
    if (item.isFeatured) {
      // Removing featured — no confirmation needed
      handleToggleFeatured()
      return
    }
    // Check if another item in the same category is already featured
    const existingFeatured = allItems?.find(
      i => i.id !== item.id && i.category === item.category && i.isFeatured
    )
    if (existingFeatured) {
      setShowFeaturedConfirm(existingFeatured.name)
    } else {
      handleToggleFeatured()
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

  if (showFeaturedConfirm) {
    const existingFeatured = allItems?.find(
      i => i.id !== item.id && i.category === item.category && i.isFeatured
    )
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg border border-ux-border">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-ux-text mb-2">
              Replace Featured Item
            </h3>
            <p className="text-ux-text-secondary mb-4">
              &ldquo;{showFeaturedConfirm}&rdquo; is already featured in {item.category || 'this category'}. Only one item per category can be featured. Replace it with &ldquo;{item.name}&rdquo;?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowFeaturedConfirm(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleToggleFeatured(existingFeatured?.id)}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Replace'}
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

            {/* Image management */}
            {onManageImages && (
              <button
                onClick={() => {
                  onManageImages()
                  onClose()
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-ux-background-secondary transition-colors text-ux-text disabled:opacity-50 flex items-center justify-between"
              >
                <span>
                  {item.imageSource !== 'none' || item.customImageUrl || item.aiImageId 
                    ? 'Manage photos & images' 
                    : 'Add photo / Create AI Photo'}
                </span>
                {!(item.imageSource !== 'none' || item.customImageUrl || item.aiImageId) && (
                  <span className="text-[10px] bg-ux-primary/10 text-ux-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">New</span>
                )}
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

            {/* Toggle featured */}
            <button
              onClick={handleFeaturedClick}
              disabled={loading}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-ux-background-secondary transition-colors text-ux-text disabled:opacity-50 flex items-center justify-between"
            >
              <span>{item.isFeatured ? 'Remove featured' : 'Mark as featured'}</span>
              {item.isFeatured && (
                <span className="text-amber-500">★</span>
              )}
            </button>
            
            {/* Move to category */}
            {otherCategories.length > 0 && (
              <div className="border-t border-ux-border pt-2 px-3">
                <p className="text-xs font-medium text-ux-text-secondary mb-2">
                  Move to category:
                </p>
                <div className="relative">
                  <select
                    disabled={loading}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleMoveToCategory(e.target.value)
                      }
                    }}
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-sm bg-white text-ux-text focus:outline-none focus:ring-2 focus:ring-ux-primary/20 transition-all cursor-pointer appearance-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select a category...</option>
                    {otherCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ux-text-secondary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
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