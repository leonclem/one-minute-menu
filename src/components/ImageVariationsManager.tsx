'use client'

import { useEffect, useMemo, useState } from 'react'
import type { GeneratedImage } from '@/types'
import { Button } from '@/components/ui'
import ImageUpload from '@/components/ImageUpload'

interface ImageVariationsManagerProps {
  itemId: string
  itemName?: string
  onClose: () => void
}

export default function ImageVariationsManager({ itemId, itemName, onClose }: ImageVariationsManagerProps) {
  const [loading, setLoading] = useState<'init' | 'select' | 'delete' | 'upload' | null>('init')
  const [error, setError] = useState<string | null>(null)
  const [variations, setVariations] = useState<GeneratedImage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)

  const selectedImage = useMemo(() => variations.find(v => v.id === selectedId) || null, [variations, selectedId])
  const compareImage = useMemo(() => variations.find(v => v.id === compareId) || null, [variations, compareId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/menu-items/${itemId}/variations`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load variations')
        if (!mounted) return
        const list: GeneratedImage[] = json?.data?.variations || []
        setVariations(list)
        setSelectedId(json?.data?.selectedImageId || null)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load variations')
      } finally {
        if (mounted) setLoading(null)
      }
    })()
    return () => { mounted = false }
  }, [itemId])

  const selectAiImage = async (imageId: string) => {
    setLoading('select')
    setError(null)
    try {
      const res = await fetch(`/api/menu-items/${itemId}/select-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, imageSource: 'ai' })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to select image')
      setSelectedId(imageId)
    } catch (e: any) {
      setError(e?.message || 'Failed to select image')
    } finally {
      setLoading(null)
    }
  }

  const deleteImage = async (imageId: string) => {
    setLoading('delete')
    setError(null)
    try {
      const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to delete image')
      setVariations(prev => prev.filter(v => v.id !== imageId))
      if (selectedId === imageId) setSelectedId(null)
      if (compareId === imageId) setCompareId(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to delete image')
    } finally {
      setLoading(null)
    }
  }

  const handleCustomUpload = async (file: File) => {
    setLoading('upload')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const upload = await fetch(`/api/menu-items/${itemId}/image`, { method: 'POST', body: formData })
      const upJson = await upload.json()
      if (!upload.ok) throw new Error(upJson?.error || 'Upload failed')

      // Switch item to use custom image via select-image API (custom mode)
      const sel = await fetch(`/api/menu-items/${itemId}/select-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: upJson?.data?.imageUrl, imageSource: 'custom' })
      })
      const selJson = await sel.json()
      if (!sel.ok) throw new Error(selJson?.error || 'Failed to select custom image')

      // Keep existing AI variations; selection is now custom, reflect by clearing selectedId
      setSelectedId(null)
      setShowUpload(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to upload/select custom image')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-lg border border-secondary-200 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-secondary-900 truncate">Manage Photos{itemName ? ` · ${itemName}` : ''}</h2>
            <p className="text-xs text-secondary-600">View variations, compare, select, delete, or switch to a custom image.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowUpload(true)} disabled={loading !== null}>
              Upload Custom
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 text-red-700 text-sm border-b">{error}</div>
        )}

        {/* Comparison area */}
        {(selectedImage || compareImage) && (
          <div className="px-4 py-4 border-b grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-secondary-600 mb-1">Current selection</div>
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedImage.desktopUrl || selectedImage.originalUrl} alt="Selected" className="w-full max-h-80 object-contain rounded border" />
              ) : (
                <div className="h-40 border rounded flex items-center justify-center text-secondary-500 text-sm">No AI image selected</div>
              )}
            </div>
            <div>
              <div className="text-xs text-secondary-600 mb-1">Candidate</div>
              {compareImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={compareImage.desktopUrl || compareImage.originalUrl} alt="Candidate" className="w-full max-h-80 object-contain rounded border" />
              ) : (
                <div className="h-40 border rounded flex items-center justify-center text-secondary-500 text-sm">Select a variation to preview</div>
              )}
            </div>
          </div>
        )}

        {/* Variations grid */}
        <div className="p-4">
          {loading === 'init' ? (
            <div className="text-sm text-secondary-600">Loading variations…</div>
          ) : variations.length === 0 ? (
            <div className="text-sm text-secondary-600">No AI-generated images yet.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {variations.map(v => (
                <div key={v.id} className={`border rounded overflow-hidden ${v.id === selectedId ? 'ring-2 ring-primary-500' : ''}`}>
                  <button type="button" className="block w-full" onClick={() => setCompareId(v.id)} aria-label="Preview variation">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.thumbnailUrl || v.mobileUrl || v.originalUrl} alt={itemName || 'Variation'} className="w-full h-32 object-cover" />
                  </button>
                  <div className="p-2 flex items-center justify-between gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => selectAiImage(v.id)}
                      disabled={loading === 'select' || v.id === selectedId}
                    >
                      {v.id === selectedId ? 'Selected' : 'Use This'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteImage(v.id)}
                      disabled={loading === 'delete'}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="w-full max-w-2xl">
              <ImageUpload
                onImageSelected={async (file) => { await handleCustomUpload(file) }}
                onCancel={() => setShowUpload(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


