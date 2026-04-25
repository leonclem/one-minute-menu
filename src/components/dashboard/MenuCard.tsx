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
  /**
   * When true, the user can view but not edit (free plan edit window expired).
   * This drives label/CTA behavior; server APIs still enforce permissions.
   */
  isEditLocked?: boolean
  /** Whether the user can delete menus (false for Free plan) */
  canDelete?: boolean
  /** Saved template selection for this menu */
  templateSelection?: { template_id: string; configuration: any } | null
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
export function MenuCard({ 
  menu, 
  isEditLocked = false, 
  canDelete = true, 
  templateSelection
}: MenuCardProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Track exporting status per type
  const [exportingType, setExportingType] = useState<'pdf' | 'image' | null>(null)

  const hasDesign = !!templateSelection?.template_id

  // Smart routing logic based on menu state (Requirements: 22.2, 22.3, 22.4, 22.5)
  const getEditUrl = () => {
    // Check if menu has items or categories (actual menu content) - prioritize this check
    const hasMenuItems = (menu.items?.length ?? 0) > 0 || (menu.categories?.length ?? 0) > 0
    
    if (hasMenuItems) {
      return `/menus/${menu.id}/extracted`
    }
    
    // If no menu items exist, check if there's a source image to extract from
    if (!menu.imageUrl) {
      return `/menus/${menu.id}/upload`
    }
    
    // Has image but no items - go to extract page
    return `/menus/${menu.id}/extract`
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleExport = async (type: 'pdf' | 'image') => {
    // Always generate a fresh export — reusing a completed job risks serving stale content
    // if the user has updated their design since the last export.
    setExportingType(type)
    try {
      const resp = await fetch('/api/export/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: menu.id,
          export_type: type,
          template_id: templateSelection?.template_id,
          configuration: templateSelection?.configuration,
        }),
      })

      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        if (resp.status === 429) {
          showToast({
            type: 'info',
            title: 'Export limit reached',
            description: data.error || 'Please try again later.',
          })
        } else {
          throw new Error(data?.error || 'Failed to create export job')
        }
        return
      }

      const jobId = data.job_id
      if (!jobId) throw new Error('No job ID returned')

      showToast({
        type: 'info',
        title: `Generating ${type.toUpperCase()}...`,
        description: 'Your menu is being prepared. This usually takes a few seconds.'
      })

      // Poll for completion
      const pollInterval = 2000
      const maxAttempts = 90 // 3 minutes
      let attempts = 0

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, pollInterval))
        const statusResp = await fetch(`/api/export/jobs/${jobId}`)
        const statusData = await statusResp.json().catch(() => ({}))
        attempts++

        if (statusData.status === 'completed' && statusData.file_url) {
          const jobInfo = { status: 'completed', file_url: statusData.file_url, job_id: jobId }
          await handleDownload(jobInfo, type)
          
          showToast({
            type: 'success',
            title: `${type.toUpperCase()} exported`,
            description: `Your menu ${type.toUpperCase()} has been downloaded successfully`
          })
          return
        }
        if (statusData.status === 'failed') {
          throw new Error(statusData.error_message || 'Export generation failed')
        }
      }

      throw new Error('Export is taking longer than expected. Please try again.')
    } catch (error) {
      console.error(`Error exporting ${type}:`, error)
      showToast({
        type: 'error',
        title: 'Export failed',
        description: error instanceof Error ? error.message : `Failed to generate ${type.toUpperCase()} export.`
      })
    } finally {
      setExportingType(null)
    }
  }

  const handleDownload = async (job: { job_id: string }, exportType: 'pdf' | 'image') => {
    try {
      const resp = await fetch(`/api/export/jobs/${job.job_id}/download-url`, {
        method: 'POST',
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        if (resp.status === 404 || data?.code === 'JOB_NOT_FOUND' || data?.code === 'STORAGE_PATH_MISSING') {
          showToast({
            type: 'info',
            title: 'Export expired',
            description: 'This export is no longer available. Re-export your menu to generate a fresh copy.',
          })
        } else {
          showToast({ type: 'error', title: 'Download failed', description: data?.error || 'Please try again.' })
        }
        return
      }

      // Fetch the file as a blob so the browser download popup is triggered,
      // regardless of whether the signed URL is cross-origin (Supabase storage).
      const fileResp = await fetch(data.file_url)
      if (!fileResp.ok) throw new Error('Failed to fetch file')
      const blob = await fileResp.blob()
      const mimeType = exportType === 'image' ? 'image/png' : 'application/pdf'
      const typedBlob = new Blob([blob], { type: mimeType })
      const objectUrl = URL.createObjectURL(typedBlob)

      const a = document.createElement('a')
      a.href = objectUrl
      a.download = data.filename || `menu-export.${exportType === 'image' ? 'png' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      showToast({ type: 'error', title: 'Download failed', description: 'Please try again.' })
    }
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
        if (error?.code === 'EDIT_WINDOW_EXPIRED') {
          showToast({
            type: 'info',
            title: 'Edits locked',
            description: error?.error || 'Your edit window has expired.',
          })
          setShowDeleteDialog(false)
          setIsDeleting(false)
          return
        }
        if (error?.code === 'FEATURE_NOT_AVAILABLE') {
          showToast({
            type: 'info',
            title: 'Not available on Free plan',
            description: 'Menu deletion is available on Grid+ and above.',
          })
          setShowDeleteDialog(false)
          setIsDeleting(false)
          return
        }
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
            {canDelete && (
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
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Categories:</span>
              <span className="text-ux-text">{menu.categories?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Items:</span>
              <span className="text-ux-text">{menu.items?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ux-text">Last updated:</span>
              <span className="text-ux-text">
                {menu.updatedAt ? menu.updatedAt.toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="pt-4 space-y-3">
              {/* Primary Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Link href={getEditUrl()} className="w-full">
                  <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-bold rounded-full btn-ux-primary text-soft-shadow transition-all hover:brightness-105">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {isEditLocked ? 'View Items' : 'Edit Items'}
                  </span>
                </Link>
                {isEditLocked ? (
                  <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-bold rounded-full bg-gray-200 text-gray-400 cursor-not-allowed shadow-sm" title="Upgrade to edit design">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    Edit Design
                  </span>
                ) : (
                  <Link href={`/menus/${menu.id}/template`} className="w-full">
                    <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-bold rounded-full bg-[#FFC107] text-[#212529] transition-all hover:brightness-105 shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      Edit Design
                    </span>
                  </Link>
                )}
              </div>

              {/* Download Actions */}
              {hasDesign ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={!!exportingType}
                    className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-semibold rounded-full border border-ux-border text-ux-text-secondary hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    {exportingType === 'pdf' ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    {exportingType === 'pdf' ? 'Preparing…' : 'PDF'}
                  </button>
                  <button
                    onClick={() => handleExport('image')}
                    disabled={!!exportingType}
                    className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-semibold rounded-full border border-ux-border text-ux-text-secondary hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    {exportingType === 'image' ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    {exportingType === 'image' ? 'Preparing…' : 'PNG'}
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs text-ux-text-secondary py-1">
                  Use <span className="font-semibold text-[#b8960e]">Edit Design</span> to set up your menu style before downloading.
                </p>
              )}
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
