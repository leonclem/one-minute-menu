'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/ImageUpload'
import { UXButton, UXCard } from '@/components/ux'
import ExtractionStatusBanner from '@/components/ExtractionStatusBanner'
import { AlertTriangle, Info, X, Plus, FileImage } from 'lucide-react'
import { createThumbnail, rotateImageQuarterTurns } from '@/lib/image-utils'

interface UploadClientProps {
  menuId: string
  menuName?: string
  hasItems?: boolean
}

export default function UploadClient({ menuId, menuName, hasItems = false }: UploadClientProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [processingImages, setProcessingImages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'submitting' | 'processing' | 'completed' | 'failed'>('idle')
  const [extractionMessage, setExtractionMessage] = useState<string | undefined>(undefined)
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [queuedFiles, setQueuedFiles] = useState<{ file: File; preview: string }[]>([])
  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null)
  const [rotatingQueueImage, setRotatingQueueImage] = useState(false)
  const jobQueue = useRef<File[]>([])
  const currentJobIndex = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate total size of queued files
  const totalSize = queuedFiles.reduce((acc, curr) => acc + curr.file.size, 0)
  const MAX_TOTAL_SIZE = 32 * 1024 * 1024 // 32MB total limit
  const MAX_FILES = 10 // Max 10 images at once

  const processQueue = useCallback(async () => {
    if (currentJobIndex.current >= jobQueue.current.length) {
      setExtractionStatus('completed')
      setExtractionProgress(100)
      setQueuedFiles([])
      setSubmitting(false)
      router.push(`/menus/${menuId}/extracted?newExtraction=true`)
      return
    }

    const file = jobQueue.current[currentJobIndex.current]
    const totalFiles = jobQueue.current.length
    const fileLabel = totalFiles > 1 ? ` (Image ${currentJobIndex.current + 1} of ${totalFiles})` : ''

    try {
      setExtractionStatus('uploading')
      setExtractionMessage(`Uploading image${fileLabel}...`)
      
      const formData = new FormData()
      formData.append('image', file)

      const uploadRes = await fetch(`/api/menus/${menuId}/image`, {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      
      if (!uploadRes.ok) {
        throw new Error(uploadData?.error || 'Upload failed')
      }

      setExtractionStatus('submitting')
      setExtractionMessage(`Starting extraction${fileLabel}...`)
      
      const extractRes = await fetch('/api/extraction/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: uploadData.data.imageUrl,
          menuId,
          schemaVersion: 'stage2'
        })
      })

      const extractData = await extractRes.json()
      
      if (!extractRes.ok) {
        throw new Error(extractData?.error || 'Extraction failed to start')
      }

      const jobId = extractData.data.jobId
      const isCached = !!extractData?.data?.cached
      
      // Polling loop for this specific job
      const maxAttempts = 60
      const delayMs = 2000
      let completed = false

      // If we got a cache hit, try once immediately (no polling delay)
      if (isCached) {
        setExtractionStatus('processing')
        setExtractionMessage(`Using cached extraction${fileLabel}...`)
        const statusResp = await fetch(`/api/extraction/status/${jobId}`)
        if (statusResp.ok) {
          const statusData = await statusResp.json()
          const status = statusData?.data?.status
          if (status === 'completed') {
            const applyRes = await fetch(`/api/menus/${menuId}/apply-extraction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                result: statusData.data.result,
                schemaVersion: statusData.data.schemaVersion,
                promptVersion: statusData.data.promptVersion,
                jobId: jobId,
                append: hasItems || currentJobIndex.current > 0
              })
            })

            if (!applyRes.ok) {
              throw new Error('Failed to apply extraction results')
            }

            completed = true
          }
        }
      }

      for (let attempt = 0; attempt < maxAttempts && !completed; attempt++) {
        const statusResp = await fetch(`/api/extraction/status/${jobId}`)
        if (statusResp.ok) {
          const statusData = await statusResp.json()
          const status = statusData?.data?.status

          setExtractionStatus('processing')
          setExtractionMessage(`AI is extracting items${fileLabel}...`)
          // Overall progress across all files
          const baseProgress = (currentJobIndex.current / totalFiles) * 100
          const currentFileProgress = ((attempt + 1) / maxAttempts) * (100 / totalFiles)
          setExtractionProgress(Math.min(95, baseProgress + currentFileProgress))

          if (status === 'completed') {
            // Apply this specific extraction
            const applyRes = await fetch(`/api/menus/${menuId}/apply-extraction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                result: statusData.data.result,
                schemaVersion: statusData.data.schemaVersion,
                promptVersion: statusData.data.promptVersion,
                jobId: jobId,
                append: hasItems || currentJobIndex.current > 0
              })
            })

            if (!applyRes.ok) {
              throw new Error('Failed to apply extraction results')
            }

            completed = true
            break
          }

          if (status === 'failed') {
            throw new Error(statusData?.error || 'Extraction failed')
          }
        }
        await new Promise(r => setTimeout(r, delayMs))
      }

      if (!completed) {
        throw new Error('Extraction timed out')
      }

      // Move to next file in queue
      currentJobIndex.current++
      processQueue()

    } catch (e: any) {
      setExtractionStatus('failed')
      setExtractionMessage(e.message || 'An error occurred during extraction.')
      setSubmitting(false)
    }
  }, [menuId, router, hasItems])

  const handleUpload = async (file: File, preview: string) => {
    if (queuedFiles.length >= MAX_FILES) {
      setError(`Maximum of ${MAX_FILES} images allowed in the queue.`)
      return
    }
    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      setError(`Total size exceeds 32MB. Please remove some images or use smaller files.`)
      return
    }
    setQueuedFiles(prev => [...prev, { file, preview }])
    setError(null)
  }

  const handleMultipleUpload = async (files: File[]) => {
    setProcessingImages(true)
    setError(null)
    const newFiles: { file: File; preview: string }[] = []
    
    for (const file of files) {
      if (queuedFiles.length + newFiles.length >= MAX_FILES) {
        setError(`Some files were skipped. Maximum of ${MAX_FILES} images allowed.`)
        break
      }
      
      const currentTotalSize = totalSize + newFiles.reduce((acc, curr) => acc + curr.file.size, 0)
      if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
        setError(`Some files were skipped. Total size cannot exceed 32MB.`)
        break
      }

      try {
        const preview = await createThumbnail(file, 400)
        newFiles.push({ file, preview })
      } catch (e) {
        console.error('Failed to create thumbnail for', file.name)
      }
    }

    setQueuedFiles(prev => [...prev, ...newFiles])
    setProcessingImages(false)
  }

  const startExtraction = useCallback(() => {
    if (queuedFiles.length === 0) return

    setSubmitting(true)
    setError(null)
    jobQueue.current = queuedFiles.map(q => q.file)
    currentJobIndex.current = 0
    
    if (menuId.startsWith('demo-')) {
      // Demo menus follow original flow
      router.push(`/menus/${menuId}/extract`)
      return
    }

    processQueue()
  }, [queuedFiles, menuId, router, processQueue])

  const removeFileFromQueue = (index: number) => {
    setQueuedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleRotateQueuedImage = async (quarterTurns: number) => {
    if (editingQueueIndex == null) return
    const entry = queuedFiles[editingQueueIndex]
    if (!entry) return

    setRotatingQueueImage(true)
    try {
      const rotated = await rotateImageQuarterTurns(entry.file, quarterTurns)
      const preview = await createThumbnail(rotated.file, 400)
      setQueuedFiles(prev => prev.map((it, idx) => (
        idx === editingQueueIndex ? { file: rotated.file, preview } : it
      )))
    } finally {
      setRotatingQueueImage(false)
    }
  }

  return (
    <section className="container-ux py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Add items for {menuName || 'your menu'}
          </h1>
          <p className="mt-2 text-white/80 text-hero-shadow">
            Upload one or more photos of your menu to extract items automatically.
          </p>
        </div>

        <ExtractionStatusBanner 
          status={extractionStatus} 
          message={extractionMessage} 
          progress={extractionProgress} 
        />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {error}
          </div>
        )}

        {extractionStatus === 'idle' && (
          <div className="space-y-6">
            <div className="card-ux bg-white/80 backdrop-blur-[1.5px]">
              <div className="p-4 pb-2 text-center">
                <p className="text-ux-text font-medium mb-1">
                  {hasItems ? 'Add more items to your menu' : 'Use clear, readable photos of your menu'}
                </p>
                <p className="text-ux-text-secondary text-sm mb-3">
                  You can upload multiple photos to capture your entire menu.
                </p>
              </div>

              {/* Selection and Queue Area */}
              <div className="px-6 pb-6">
                {queuedFiles.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {queuedFiles.map((item, idx) => (
                        <div key={`${item.file.name}-${idx}`} className="relative group">
                          <div className="aspect-[3/4] rounded-lg border-2 border-ux-border bg-ux-background-secondary overflow-hidden flex flex-col items-center justify-center text-center relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={item.preview} 
                              alt={`Preview ${idx + 1}`}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                            <div className="relative z-10 p-2 bg-white/90 backdrop-blur-[2px] w-full mt-auto border-t border-ux-border">
                              <span className="text-[10px] text-ux-text font-semibold truncate block w-full">
                                {item.file.name}
                              </span>
                              <span className="text-[10px] font-bold text-ux-primary">
                                {(item.file.size / 1024 / 1024).toFixed(1)} MB
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingQueueIndex(idx)}
                            className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-full bg-white/90 border border-ux-border text-ux-text hover:bg-white transition-colors z-20"
                            title="Rotate / adjust"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeFileFromQueue(idx)}
                            className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-ux-warning text-ux-text flex items-center justify-center shadow-lg hover:bg-amber-500 transition-colors z-20 border-2 border-white group-active:scale-95"
                            title="Remove image"
                          >
                            <X className="h-4 w-4 stroke-[3px]" />
                          </button>
                        </div>
                      ))}
                      
                      {/* Add more button */}
                      {queuedFiles.length < MAX_FILES && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-[3/4] rounded-lg border-2 border-dashed border-ux-border bg-white/40 hover:bg-white/60 hover:border-ux-primary transition-all flex flex-col items-center justify-center text-ux-text-secondary hover:text-ux-primary"
                        >
                          <Plus className="h-8 w-8 mb-2" />
                          <span className="text-xs font-medium">Add another</span>
                        </button>
                      )}
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-xs text-ux-text-secondary">
                          Queue: <span className="font-semibold text-ux-text">{queuedFiles.length}/{MAX_FILES}</span> images
                        </span>
                        <span className="text-xs text-ux-text-secondary">
                          Total size: <span className={`font-semibold ${totalSize > MAX_TOTAL_SIZE * 0.8 ? 'text-red-500' : 'text-ux-text'}`}>
                            {(totalSize / 1024 / 1024).toFixed(1)} MB
                          </span> / 32 MB
                        </span>
                      </div>
                      
                      <UXButton
                        variant="primary"
                        size="lg"
                        className="w-full py-4 text-lg"
                        onClick={startExtraction}
                      >
                        Extract {queuedFiles.length} {queuedFiles.length === 1 ? 'Photo' : 'Photos'} Now
                      </UXButton>
                      <p className="text-center text-xs text-ux-text-secondary">
                        AI will process these images one by one and append the items.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ImageUpload
                    onImageSelected={(file, preview) => handleUpload(file, preview)}
                    onImagesSelected={(files) => handleMultipleUpload(files)}
                    multiple
                    skipPreview
                    className="w-full bg-transparent shadow-none"
                  />
                )}
              </div>
              
              <div className="px-6 pb-6 pt-2 border-t border-ux-border/50 flex items-center gap-2 text-ux-text-secondary text-xs italic justify-center">
                <Info className="h-3 w-3" />
                <span>AI extraction is fast but not always perfect. You&apos;ll be able to review and fix any mistakes in the next step.</span>
              </div>

              {/* Hidden input for "Add another" functionality */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    handleMultipleUpload(Array.from(e.target.files))
                    // Reset value so same file can be selected again
                    e.target.value = ''
                  }
                }}
              />

              {/* Rotate/Edit modal for queued images */}
              {editingQueueIndex != null && queuedFiles[editingQueueIndex] && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-md">
                    <UXCard>
                      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
                        <h3 className="text-sm font-semibold text-ux-text">Adjust photo</h3>
                        <button
                          type="button"
                          className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                          onClick={() => !rotatingQueueImage && setEditingQueueIndex(null)}
                          aria-label="Close photo editor"
                          disabled={rotatingQueueImage}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="rounded-lg overflow-hidden border border-ux-border bg-ux-background-secondary">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={queuedFiles[editingQueueIndex].preview}
                            alt="Queued menu photo preview"
                            className="w-full max-h-[60vh] object-contain bg-white"
                          />
                        </div>

                        <div className="flex gap-3">
                          <UXButton
                            variant="outline"
                            className="flex-1 bg-white"
                            onClick={() => handleRotateQueuedImage(3)}
                            disabled={rotatingQueueImage}
                          >
                            Rotate left
                          </UXButton>
                          <UXButton
                            variant="outline"
                            className="flex-1 bg-white"
                            onClick={() => handleRotateQueuedImage(1)}
                            disabled={rotatingQueueImage}
                          >
                            Rotate right
                          </UXButton>
                        </div>

                        <UXButton
                          variant="primary"
                          className="w-full"
                          onClick={() => setEditingQueueIndex(null)}
                          disabled={rotatingQueueImage}
                        >
                          Done
                        </UXButton>
                      </div>
                    </UXCard>
                  </div>
                </div>
              )}

              {/* Processing Overlay */}
              {processingImages && (
                <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-md">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ux-primary mb-3"></div>
                  <p className="text-sm font-semibold text-ux-text">Optimizing images...</p>
                </div>
              )}

              {/* Hidden ImageUpload for "Add another" functionality when queue is active */}
              {queuedFiles.length > 0 && (
                <div className="hidden">
                  <ImageUpload
                    onImageSelected={(file, preview) => handleUpload(file, preview)}
                    onImagesSelected={(files) => handleMultipleUpload(files)}
                    multiple
                    skipPreview
                  />
                </div>
              )}
            </div>

            {hasItems && (
              <div className="text-center py-6">
                <Link href={`/menus/${menuId}/extracted`}>
                  <UXButton variant="outline" className="bg-white/20 border-white/40 text-white hover:bg-white/30">
                    ← Back to Menu Items
                  </UXButton>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Only show manual entry if the menu is empty */}
        {!hasItems && extractionStatus === 'idle' && (
          <div className="mt-10 text-center space-y-2">
            <p className="text-sm text-white/90 text-hero-shadow">
              Prefer to build everything by hand instead?
            </p>
            <div className="flex justify-center items-center">
              <Link href={`/menus/${menuId}/extracted?manual=true`} aria-label="Enter items manually in the extracted page">
                <UXButton variant="warning" size="md" noShadow className="min-w-[220px] py-2">
                  Enter items manually
                </UXButton>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}




