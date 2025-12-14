"use client"

import { useState } from 'react'
import Link from 'next/link'
import { UXCard } from '@/components/ux'
import { DeleteMenuDialog } from './DeleteMenuDialog'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import type { Menu } from '@/types'

interface MenuCardProps {
  menu: Menu
}

/**
 * MenuCard Component
 * 
 * Displays a menu card with edit and delete functionality.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 22.2, 22.3, 22.4, 22.5
 * - Display delete button for each menu
 * - Show confirmation dialog on delete
 * - Handle menu deletion with API call
 * - Smart routing based on menu state
 */
export function MenuCard({ menu }: MenuCardProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Smart routing logic based on menu state (Requirements: 22.2, 22.3, 22.4, 22.5)
  const getEditUrl = () => {
    // Check if menu has items or categories (actual menu content) - prioritize this check
    const hasMenuItems = (menu.items?.length ?? 0) > 0 || (menu.categories?.length ?? 0) > 0
    
    if (hasMenuItems) {
      return `/ux/menus/${menu.id}/extracted`
    }
    
    // If no menu items exist, check if there's a source image to extract from
    if (!menu.imageUrl) {
      return `/menus/${menu.id}/upload`
    }
    
    // Has image but no items - go to extract page
    return `/ux/menus/${menu.id}/extract`
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/menus/${menu.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete menu')
      }

      // Close dialog
      setShowDeleteDialog(false)
      
      // Show success message (Requirement: 1.4)
      showToast({
        type: 'success',
        title: 'Menu deleted',
        description: `"${menu.name}" has been permanently deleted.`,
      })
      
      // Refresh the page to show updated menu list
      router.refresh()
    } catch (error) {
      console.error('Error deleting menu:', error)
      showToast({
        type: 'error',
        title: 'Failed to delete menu',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
      setIsDeleting(false)
    }
  }

  return (
    <>
      <UXCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-ux-text flex-1 mr-2">
              {menu.name}
            </h3>
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title="Delete menu"
              aria-label="Delete menu"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                />
              </svg>
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Status:</span>
              <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                menu.status === 'published' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {menu.status}
                {menu.status === 'published' && menu.publishedAt && (
                  <span className="ml-1 text-xs opacity-75">
                    ({menu.publishedAt.toLocaleDateString()})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Items:</span>
              <span className="text-ux-text">{menu.items?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Version:</span>
              <span className="text-ux-text">v{menu.version}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Last updated:</span>
              <span className="text-ux-text">
                {menu.updatedAt ? menu.updatedAt.toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Published:</span>
              <span className="text-ux-text">
                {menu.status === 'published' && menu.publishedAt
                  ? menu.publishedAt.toLocaleDateString()
                  : 'Not yet published'}
              </span>
            </div>
            <div className="pt-3 flex justify-center">
              <Link
                href={getEditUrl()}
                className="inline-block w-full sm:w-auto"
              >
                <span className="inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ux-primary focus:ring-offset-2 btn-ux-primary px-5 py-2.5 text-sm rounded-full text-soft-shadow w-full sm:w-auto">
                  Edit menu
                </span>
              </Link>
            </div>
          </div>
        </div>
      </UXCard>

      <DeleteMenuDialog
        open={showDeleteDialog}
        menuName={menu.name}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  )
}
