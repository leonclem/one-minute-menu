'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { UXCard, UXButton } from './index'
import ImageUpload from '@/components/ImageUpload'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'

interface LogoUploadModalProps {
  menuId: string
  logoUrl: string | null
  onSuccess: (updatedMenu: Menu) => void
  onClose: () => void
}

export function LogoUploadModal({ menuId, logoUrl, onSuccess, onClose }: LogoUploadModalProps) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const busy = uploading || removing

  const handleImageSelected = async (file: File, _preview: string) => {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/menus/${menuId}/logo`, {
        method: 'POST',
        body: formData,
      })
      const json = await response.json()

      if (!response.ok) {
        const message =
          json?.error ||
          (json?.code === 'PLAN_LIMIT_EXCEEDED'
            ? 'You have reached your monthly upload limit.'
            : 'Failed to upload logo. Please try again.')
        setError(message)
        showToast({
          type: json?.code === 'PLAN_LIMIT_EXCEEDED' ? 'info' : 'error',
          title: 'Logo upload failed',
          description: message,
        })
        return
      }

      const updatedMenu = (json?.data?.menu || json?.data) as Menu
      showToast({ type: 'success', title: 'Logo added', description: 'Your logo will appear on compatible templates.' })
      onSuccess(updatedMenu)
      onClose()
    } catch {
      const message = 'Network error while uploading logo. Please try again.'
      setError(message)
      showToast({ type: 'error', title: 'Logo upload failed', description: message })
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    try {
      const response = await fetch(`/api/menus/${menuId}/logo`, { method: 'DELETE' })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Failed to remove logo')

      const updatedMenu = json.data as Menu
      showToast({ type: 'success', title: 'Logo removed' })
      onSuccess(updatedMenu)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove logo. Please try again.'
      setError(message)
      showToast({ type: 'error', title: 'Removal failed', description: message })
    } finally {
      setRemoving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md">
          <UXCard>
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
              <h3 className="text-sm font-semibold text-ux-text">
                {logoUrl ? 'Manage logo' : 'Upload logo'}
              </h3>
              <button
                type="button"
                className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                onClick={() => !busy && onClose()}
                aria-label="Close"
                disabled={busy}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 pt-3 space-y-3">
              {error && (
                <div className="p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
                  {error}
                </div>
              )}
              <p className="text-xs text-ux-text-secondary">
                {logoUrl
                  ? 'Upload a new logo to swap it, or remove the current one. Best as square JPEG/PNG up to 8MB.'
                  : 'Upload a JPEG or PNG logo (up to 8MB). For best results, use a square logo with a transparent or solid background.'}
              </p>

              <div className={busy ? 'pointer-events-none opacity-60' : ''}>
                <ImageUpload
                  onImageSelected={handleImageSelected}
                  onCancel={() => !busy && onClose()}
                  noWrapper={true}
                  outputFormat="png"
                />
              </div>

              {logoUrl && (
                <div className="flex items-center justify-between pt-3 border-t border-dashed border-ux-border/60">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ux-text-secondary">Current logo:</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Current logo"
                      className="h-9 w-9 rounded-full border border-ux-border object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <UXButton
                    variant="outline"
                    size="sm"
                    onClick={handleRemove}
                    loading={removing}
                    disabled={uploading}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-8 text-[11px]"
                  >
                    Remove Logo
                  </UXButton>
                </div>
              )}
            </div>
          </UXCard>
        </div>
      </div>
    </div>,
    document.body
  )
}
