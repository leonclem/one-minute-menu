'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Scissors, CheckCircle2, Trash2, ImageOff, Maximize2, Loader2, ChevronLeft, RefreshCw, Hourglass } from 'lucide-react'
import type { GeneratedImage, PhotoGenerationParams } from '@/types'
import { useToast } from '@/components/ui'
import ZoomableImageModal from '@/components/ZoomableImageModal'

interface PhotoGalleryModalProps {
  itemId: string
  menuId: string
  itemName: string
  itemDescription?: string
  onClose: () => void
  onImageSelected?: (itemId: string, imageUrl: string) => void
  onOpenGenerate: (params?: Partial<PhotoGenerationParams>) => void
}

export default function PhotoGalleryModal({
  itemId,
  menuId,
  itemName,
  itemDescription,
  onClose,
  onImageSelected,
  onOpenGenerate
}: PhotoGalleryModalProps) {
  const [loading, setLoading] = useState<boolean>(true)
  const [variations, setVariations] = useState<GeneratedImage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [requestingCutouts, setRequestingCutouts] = useState<Set<string>>(new Set())
  const [viewingCutoutImageId, setViewingCutoutImageId] = useState<string | null>(null)
  const [deletingCutoutImageId, setDeletingCutoutImageId] = useState<string | null>(null)
  const [showCutoutTip, setShowCutoutTip] = useState<boolean>(true)
  const { showToast } = useToast()

  // Primary brand color: #01B3BF
  // Secondary brand color: #F8BC02

  useEffect(() => {
    let mounted = true

    const loadVariations = async (showLoader: boolean) => {
      try {
        if (showLoader) setLoading(true)
        const res = await fetch(`/api/menu-items/${itemId}/variations`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load variations')
        if (!mounted) return

        setVariations(json?.data?.variations || [])
        setSelectedId(json?.data?.selectedImageId || null)
      } catch (e: any) {
        if (!mounted) return
        showToast({
          type: 'error',
          title: 'Failed to load photos',
          description: e.message
        })
      } finally {
        if (mounted && showLoader) setLoading(false)
      }
    }

    loadVariations(true)

    // Force a fresh fetch after 500ms to catch batch generation defaults
    // This ensures newly created images with selected=true are properly reflected
    const freshFetchTimeout = window.setTimeout(() => {
      if (mounted) loadVariations(false)
    }, 500)

    const pollInterval = window.setInterval(() => {
      loadVariations(false)
    }, 5000)

    return () => {
      mounted = false
      window.clearTimeout(freshFetchTimeout)
      window.clearInterval(pollInterval)
    }
  }, [itemId, showToast])

  const updateCutoutStatusLocally = (imageId: string, status: string) => {
    setVariations(prev =>
      prev.map(v =>
        v.id === imageId
          ? {
              ...v,
              metadata: {
                ...(v.metadata || {}),
                cutoutStatus: status,
              },
            }
          : v
      )
    )
  }

  const handleSelectImage = async (imageId: string | null) => {
    try {
      const res = await fetch(`/api/menu-items/${itemId}/select-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageId: imageId || undefined, 
          imageSource: imageId ? 'ai' : 'none' 
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to select image')
      
      setSelectedId(imageId)
      if (onImageSelected) {
        const url = variations.find(v => v.id === imageId)?.originalUrl || ''
        onImageSelected(itemId, url)
      }
      
      showToast({
        type: 'success',
        title: imageId ? 'Photo selected' : 'Photo removed',
        durationMs: 2000
      })
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Selection failed',
        description: e.message
      })
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return

    try {
      const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete image')
      
      setVariations(prev => prev.filter(v => v.id !== imageId))
      if (selectedId === imageId) {
        setSelectedId(null)
        if (onImageSelected) onImageSelected(itemId, '')
      }
      
      showToast({ type: 'success', title: 'Photo deleted' })
    } catch (e: any) {
      showToast({ type: 'error', title: 'Delete failed', description: e.message })
    }
  }

  const handleCutoutClick = (image: GeneratedImage) => {
    const rawStatus = String(image.metadata?.cutoutStatus || 'not_requested')
    const cutoutStatus = rawStatus === 'completed' ? 'succeeded' : rawStatus
    const hasCutout = cutoutStatus === 'succeeded'

    if (hasCutout) {
      // Yellow scissors: open cutout view
      setShowCutoutTip(true)
      setViewingCutoutImageId(image.id)
    } else {
      // Grey scissors: request cutout
      requestCutout(image)
    }
  }

  const requestCutout = async (image: GeneratedImage) => {
    const rawStatus = String(image.metadata?.cutoutStatus || 'not_requested')
    const cutoutStatus = rawStatus === 'completed' ? 'succeeded' : rawStatus
    const isSucceeded = cutoutStatus === 'succeeded'
    const isInProgress =
      cutoutStatus === 'pending' ||
      cutoutStatus === 'processing' ||
      requestingCutouts.has(image.id)

    if (isInProgress) {
      showToast({ type: 'info', title: 'Cutout already in progress', durationMs: 2000 })
      return
    }

    try {
      setRequestingCutouts(prev => new Set(prev).add(image.id))
      updateCutoutStatusLocally(image.id, 'pending')

      const res = await fetch(`/api/cutout/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to request cutout')

      showToast({
        type: 'success',
        title: isSucceeded ? 'Cutout regeneration requested' : 'Cutout requested',
        description: 'Your cutout will be processed shortly',
        durationMs: 3000
      })
    } catch (e: any) {
      updateCutoutStatusLocally(image.id, cutoutStatus)
      showToast({
        type: 'error',
        title: 'Cutout request failed',
        description: e.message
      })
    } finally {
      setRequestingCutouts(prev => {
        const next = new Set(prev)
        next.delete(image.id)
        return next
      })
    }
  }

  const handleDeleteCutout = async () => {
    if (!viewingCutoutImageId || !confirm('Delete this cutout? You can regenerate it later.')) return

    try {
      setDeletingCutoutImageId(viewingCutoutImageId)
      
      const res = await fetch(`/api/cutout/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: viewingCutoutImageId })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to delete cutout')

      updateCutoutStatusLocally(viewingCutoutImageId, 'not_requested')
      setViewingCutoutImageId(null)
      showToast({ 
        type: 'success', 
        title: 'Cutout deleted',
        durationMs: 2000
      })
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Failed to delete cutout',
        description: e.message
      })
    } finally {
      setDeletingCutoutImageId(null)
    }
  }

  const renderTile = (image: GeneratedImage) => {
    const isSelected = selectedId === image.id
    const rawCutoutStatus = String(image.metadata?.cutoutStatus || 'not_requested')
    const cutoutStatus = rawCutoutStatus === 'completed' ? 'succeeded' : rawCutoutStatus
    const hasCutout = cutoutStatus === 'succeeded'
    const isCutoutProcessing =
      cutoutStatus === 'pending' ||
      cutoutStatus === 'processing' ||
      requestingCutouts.has(image.id)
    const cutoutTitle =
      cutoutStatus === 'not_requested'
        ? 'Request cutout'
        : cutoutStatus === 'pending' || cutoutStatus === 'processing'
          ? 'Cutout processing'
          : cutoutStatus === 'succeeded'
            ? 'Regenerate cutout'
            : 'Retry cutout'
    const angleLabel = image.metadata?.angle || ''

    return (
      <div 
        key={image.id}
        className={`relative aspect-square rounded-2xl overflow-hidden border-[3px] transition-all cursor-pointer group ${
          isSelected ? 'border-[#01B3BF] shadow-lg scale-[1.02] z-10' : 'border-transparent hover:border-secondary-200'
        }`}
        onClick={() => handleSelectImage(image.id)}
      >
        <img 
          src={image.thumbnailUrl || image.originalUrl} 
          alt="" 
          className="w-full h-full object-cover"
        />
        
        {/* Angle Label */}
        {angleLabel && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-wider">
            {angleLabel}
          </div>
        )}

        {/* Selected Overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-[#01B3BF]/10 flex items-center justify-center">
            <div className="bg-white rounded-full p-1 shadow-md">
              <CheckCircle2 className="w-8 h-8 text-[#01B3BF] fill-white" />
            </div>
          </div>
        )}

        {/* Action Buttons Container – Bottom Left (Phase 3.3) */}
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          {/* Cutout Icon */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCutoutClick(image)
            }}
            disabled={isCutoutProcessing}
            className={`w-9 h-9 flex items-center justify-center rounded-xl backdrop-blur-md transition-all ${
              hasCutout
                ? 'bg-[#01B3BF] text-white shadow-sm'
                : isCutoutProcessing
                  ? 'bg-[#F8BC02] text-white shadow-sm cursor-not-allowed'
                  : 'bg-black/30 text-white/80 hover:bg-black/50'
            }`}
            title={cutoutTitle}
          >
            {isCutoutProcessing ? (
              <Hourglass className="w-4 h-4" />
            ) : (
              <Scissors className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Right side actions (Delete and Zoom) */}
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteImage(image.id)
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/80 text-white backdrop-blur-md transition-opacity hover:bg-red-600 lg:opacity-0 lg:group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Button – Top Right */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setPreviewImageUrl(image.originalUrl)
          }}
          className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-xl bg-black/30 text-white backdrop-blur-md transition-opacity hover:bg-black/50 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-secondary-100 flex items-start justify-between bg-white sticky top-0 z-10">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-secondary-900 truncate">{itemName}</h2>
            {itemDescription && (
              <p className="text-sm text-secondary-500 line-clamp-1 mt-1">{itemDescription}</p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="ml-4 p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-50 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {viewingCutoutImageId ? (
            // Cutout Preview View
            (() => {
              const image = variations.find(v => v.id === viewingCutoutImageId)
              if (!image) return null
              const isCutoutDeleting = deletingCutoutImageId === viewingCutoutImageId
              
              return (
                <div className="flex flex-col gap-6">
                  {/* Guidance Message - Above Image */}
                  {showCutoutTip && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start justify-between gap-4">
                      <p className="text-sm text-blue-900 flex-1">
                        <span className="font-semibold">Tip:</span> If the cutout effect hasn't executed well, consider re-working or refining the original image for better contrasting background. This helps the AI create a cleaner cutout.
                      </p>
                      <button
                        onClick={() => setShowCutoutTip(false)}
                        className="flex-shrink-0 p-1 text-blue-400 hover:text-blue-600 transition-colors"
                        title="Close tip"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-secondary-50 border-2 border-secondary-200">
                    <img 
                      src={image.metadata?.cutoutUrl || image.originalUrl}
                      alt="Cutout"
                      className="w-full h-full object-contain bg-transparent"
                    />
                    
                    {/* Top-left: Return button */}
                    <button
                      onClick={() => setViewingCutoutImageId(null)}
                      className="absolute top-2 left-2 w-9 h-9 flex items-center justify-center rounded-xl bg-black/30 text-white backdrop-blur-md transition-opacity hover:bg-black/50"
                      title="Return to main image"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Top-right: Zoom */}
                    <button
                      onClick={() => setPreviewImageUrl(image.metadata?.cutoutUrl || image.originalUrl)}
                      className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-xl bg-black/30 text-white backdrop-blur-md transition-opacity hover:bg-black/50"
                      title="Zoom cutout"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    
                    {/* Bottom-left: Regenerate */}
                    <button
                      onClick={() => {
                        setViewingCutoutImageId(null)
                        requestCutout(image)
                      }}
                      disabled={requestingCutouts.has(image.id)}
                      className="absolute bottom-2 left-2 w-9 h-9 flex items-center justify-center rounded-xl bg-[#01B3BF] text-white backdrop-blur-md transition-all hover:bg-[#00a3ad] disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Regenerate cutout"
                    >
                      {requestingCutouts.has(image.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    
                    {/* Bottom-right: Delete */}
                    <button
                      onClick={handleDeleteCutout}
                      disabled={isCutoutDeleting}
                      className="absolute bottom-2 right-2 w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/80 text-white backdrop-blur-md transition-all hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete cutout"
                    >
                      {isCutoutDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })()
          ) : (
            // Gallery Grid View
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-[0.2em]">Select Photo</h3>
                <span className="text-xs font-bold text-[#01B3BF] bg-[#01B3BF]/10 px-3 py-1 rounded-full">
                  {variations.length} variations
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {/* "+ New" Tile */}
            <button
              onClick={() => onOpenGenerate()}
              className="aspect-square rounded-2xl bg-[#01B3BF]/5 border-2 border-dashed border-[#01B3BF]/30 flex flex-col items-center justify-center gap-3 text-[#01B3BF] hover:bg-[#01B3BF]/10 hover:border-[#01B3BF]/50 transition-all group"
            >
              <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8" />
              </div>
              <span className="font-bold text-sm tracking-tight">New Photo</span>
            </button>

            {/* "No Photo" Tile */}
            <button
              onClick={() => handleSelectImage(null)}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 transition-all border-[3px] ${
                selectedId === null 
                  ? 'bg-[#01B3BF]/5 border-[#01B3BF] text-[#01B3BF] shadow-md scale-[1.02]' 
                  : 'bg-white border-secondary-100 text-secondary-400 hover:border-secondary-200'
              }`}
            >
              <div className={`p-4 rounded-2xl transition-all ${selectedId === null ? 'bg-white shadow-sm' : 'bg-secondary-50'}`}>
                <ImageOff className={`w-8 h-8 ${selectedId === null ? 'text-[#01B3BF]' : 'text-secondary-300'}`} />
              </div>
              <span className="font-bold text-sm tracking-tight">No Photo</span>
            </button>

            {/* Variation Tiles */}
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-secondary-50 animate-pulse" />
              ))
            ) : (
              variations.map(renderTile)
            )}
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="px-8 py-4 bg-secondary-50 border-t border-secondary-100 flex items-center justify-end">
          <p className="text-[10px] text-secondary-400 uppercase font-bold tracking-widest">
            Manage your menu item photography
          </p>
        </div>
      </div>

      {previewImageUrl && (
        <ZoomableImageModal
          isOpen={!!previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
          url={previewImageUrl}
          alt={itemName}
        />
      )}
    </div>,
    document.body
  )
}

