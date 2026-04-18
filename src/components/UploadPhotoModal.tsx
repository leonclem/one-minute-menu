'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import { useToast } from '@/components/ui'

interface UploadPhotoModalProps {
  itemId: string
  itemName: string
  onClose: () => void
  /** Called after a successful upload so the gallery can refresh */
  onSuccess: () => void
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export default function UploadPhotoModal({
  itemId,
  itemName,
  onClose,
  onSuccess
}: UploadPhotoModalProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleImageSelected = async (file: File, _preview: string) => {
    setUploadState('uploading')
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch(`/api/menu-items/${itemId}/image`, {
        method: 'POST',
        body: formData
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || 'Upload failed')
      }

      setUploadState('success')

      // Auto-select the uploaded image so it becomes active immediately.
      // If uploadedImageId is present, use the tracked record UUID.
      // If not (migration pending), the upload route already set custom_image_url directly.
      if (json?.data?.uploadedImageId) {
        try {
          await fetch(`/api/menu-items/${itemId}/select-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageId: json.data.uploadedImageId,
              imageSource: 'custom'
            })
          })
        } catch {
          // Non-blocking — user can select manually from the gallery
        }
      }
      // When uploadedImageId is null, the upload route already handled the
      // menu_items update and JSONB sync as a fallback — nothing more to do here.

      showToast({
        type: 'success',
        title: 'Photo uploaded',
        description: 'Your photo has been added to the gallery.',
        durationMs: 3000
      })

      // Brief pause so the success state is visible, then hand off to parent
      setTimeout(() => {
        onSuccess()
      }, 800)
    } catch (e: any) {
      setUploadState('error')
      setErrorMessage(e.message || 'Something went wrong. Please try again.')
    }
  }

  const handleRetry = () => {
    setUploadState('idle')
    setErrorMessage(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-secondary-100 flex items-center justify-between bg-white">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-secondary-900 truncate">{itemName}</h2>
            <p className="text-sm text-secondary-500 mt-0.5">Upload a photo from your device</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {uploadState === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-[#01B3BF]/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#01B3BF] animate-spin" />
              </div>
              <p className="text-sm font-medium text-secondary-600">Uploading your photo…</p>
            </div>
          )}

          {uploadState === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-sm font-medium text-secondary-600">Photo uploaded successfully!</p>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Upload failed</p>
                  <p className="text-sm text-red-700 mt-0.5">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={handleRetry}
                className="px-6 py-2.5 rounded-full bg-[#01B3BF] text-white text-sm font-bold hover:bg-[#00a3ad] transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {uploadState === 'idle' && (
            <div>
              <p className="text-xs text-secondary-400 font-medium uppercase tracking-wider mb-4">
                Supported formats: JPG, PNG, WebP · Max 10 MB
              </p>
              <ImageUpload
                onImageSelected={handleImageSelected}
                onCancel={onClose}
                maxSize={10 * 1024 * 1024}
                noWrapper
                primaryUploadLabel="Choose photo"
                uploadButtonVariant="primary"
                enableCamera
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
