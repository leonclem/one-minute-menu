'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/ImageUpload'
import { UXButton, UXCard } from '@/components/ux'
import ExtractionStatusBanner from '@/components/ExtractionStatusBanner'
import { Info, X } from 'lucide-react'
import { createThumbnail, rotateImageQuarterTurns } from '@/lib/image-utils'

interface UploadClientProps {
  menuId: string
  menuName?: string
  hasItems?: boolean
}

export default function UploadClient({ menuId, menuName, hasItems = false }: UploadClientProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'submitting' | 'processing' | 'completed' | 'failed'>('idle')
  const [extractionMessage, setExtractionMessage] = useState<string | undefined>(undefined)
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [queuedFile, setQueuedFile] = useState<{ file: File; preview: string } | null>(null)
  const [editingImage, setEditingImage] = useState(false)
  const [rotatingImage, setRotatingImage] = useState(false)

  const startExtraction = useCallback(async () => {
    if (!queuedFile) return
    if (menuId.startsWith('demo-')) {
      router.push(`/menus/${menuId}/extract`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      setExtractionStatus('uploading')
      setExtractionMessage('Uploading image...')

      const formData = new FormData()
      formData.append('image', queuedFile.file)

      const uploadRes = await fetch(`/api/menus/${menuId}/image`, {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData?.error || 'Upload failed')

      setExtractionStatus('submitting')
      setExtractionMessage('Please bear with us, this can take a couple of minutes for menus with a large number of items.')

      const extractRes = await fetch('/api/extraction/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadData.data.imageUrl, menuId, schemaVersion: 'stage2' })
      })
      const extractData = await extractRes.json()
      if (!extractRes.ok) throw new Error(extractData?.error || 'Extraction failed to start')

      const jobId = extractData.data.jobId
      const isCached = !!extractData?.data?.cached

      if (isCached) {
        setExtractionStatus('processing')
        setExtractionMessage('Using cached extraction...')
        const statusResp = await fetch(`/api/extraction/status/${jobId}`)
        if (statusResp.ok) {
          const statusData = await statusResp.json()
          if (statusData?.data?.status === 'completed') {
            const applyRes = await fetch(`/api/menus/${menuId}/apply-extraction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                result: statusData.data.result,
                schemaVersion: statusData.data.schemaVersion,
                promptVersion: statusData.data.promptVersion,
                jobId,
                append: hasItems,
              })
            })
            if (!applyRes.ok) throw new Error('Failed to apply extraction results')
          }
        }
      }

      sessionStorage.setItem(`extractionJobs:${menuId}`, JSON.stringify([jobId]))
      sessionStorage.setItem(`extractionJob:${menuId}`, jobId)
      setExtractionStatus('processing')
      setExtractionMessage('Sending you to the next step to review your items…')
      setExtractionProgress(100)
      setQueuedFile(null)
      setSubmitting(false)
      router.push(`/menus/${menuId}/extracted?newExtraction=true`)
    } catch (e: any) {
      setExtractionStatus('failed')
      setExtractionMessage(e.message || 'An error occurred during extraction.')
      setSubmitting(false)
    }
  }, [queuedFile, menuId, router, hasItems])

  const handleRotate = async (quarterTurns: number) => {
    if (!queuedFile) return
    setRotatingImage(true)
    try {
      const rotated = await rotateImageQuarterTurns(queuedFile.file, quarterTurns)
      const preview = await createThumbnail(rotated.file, 400)
      setQueuedFile({ file: rotated.file, preview })
    } finally {
      setRotatingImage(false)
    }
  }

  return (
    <section className="container-ux py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Let&apos;s add items to {menuName || 'your menu'}
          </h1>
          <p className="mt-2 text-white/80 text-hero-shadow">
            {hasItems
              ? 'Upload a photo to scan more items — or jump back to your items to edit.'
              : "Upload a photo of your existing menu and we'll pull out the items for you. Or enter them manually."}
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
                {!hasItems ? (
                  <>
                    <p className="text-ux-text font-semibold mb-1">
                      Do you have a menu you can photograph?
                    </p>
                    <p className="text-ux-text-secondary text-sm mb-1">
                      Upload one clear photo and we&apos;ll extract the items for you. You can scan more pages after reviewing.
                    </p>
                  </>
                ) : (
                  <p className="text-ux-text font-medium mb-1">Upload a menu photo to scan more items</p>
                )}
              </div>

              <div className="px-6 pb-6">
                {queuedFile ? (
                  <div className="space-y-4">
                    <div className="relative group max-w-xs mx-auto">
                      <div className="aspect-[3/4] rounded-lg border-2 border-ux-border bg-ux-background-secondary overflow-hidden relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={queuedFile.preview}
                          alt="Menu photo preview"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="relative z-10 p-2 bg-white/90 backdrop-blur-[2px] w-full absolute bottom-0 border-t border-ux-border">
                          <span className="text-[10px] text-ux-text font-semibold truncate block w-full">{queuedFile.file.name}</span>
                          <span className="text-[10px] font-bold text-ux-primary">{(queuedFile.file.size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingImage(true)}
                        className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-full bg-white/90 border border-ux-border text-ux-text hover:bg-white transition-colors z-20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setQueuedFile(null)}
                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-ux-warning text-ux-text flex items-center justify-center shadow-lg hover:bg-amber-500 transition-colors z-20 border-2 border-white"
                        title="Remove image"
                      >
                        <X className="h-4 w-4 stroke-[3px]" />
                      </button>
                    </div>

                    <UXButton
                      variant="primary"
                      size="lg"
                      className="w-full py-4 text-lg"
                      onClick={startExtraction}
                      disabled={submitting}
                    >
                      Extract items from photo
                    </UXButton>
                  </div>
                ) : (
                  <>
                    <ImageUpload
                      onImageSelected={async (file, preview) => {
                        const thumb = preview || await createThumbnail(file, 400)
                        setQueuedFile({ file, preview: thumb })
                        setError(null)
                      }}
                      multiple={false}
                      skipPreview
                      enableCamera={false}
                      primaryUploadLabel={hasItems ? 'Upload a menu photo' : 'Upload menu photo'}
                      uploadButtonVariant="primary"
                      className="w-full bg-transparent shadow-none"
                    />

                    {!hasItems && (
                      <div className="mt-5">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-ux-border/60" />
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-white/80 backdrop-blur-[1px] text-ux-text-secondary font-semibold tracking-wide">OR</span>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-center">
                          <Link href={`/menus/${menuId}/extracted?manual=true`} aria-label="Enter items manually">
                            <UXButton variant="warning" size="md" noShadow className="min-w-[220px] py-2">
                              Enter items manually
                            </UXButton>
                          </Link>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="px-6 pb-6 pt-2 border-t border-ux-border/50 flex items-center gap-2 text-ux-text-secondary text-xs italic justify-center">
                <Info className="h-3 w-3" />
                <span>AI extraction is fast but not always perfect. You&apos;ll be able to review and fix any mistakes in the next step.</span>
              </div>

              {/* Rotate/Edit modal */}
              {editingImage && queuedFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-md">
                    <UXCard>
                      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
                        <h3 className="text-sm font-semibold text-ux-text">Adjust photo</h3>
                        <button
                          type="button"
                          className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                          onClick={() => !rotatingImage && setEditingImage(false)}
                          aria-label="Close photo editor"
                          disabled={rotatingImage}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="rounded-lg overflow-hidden border border-ux-border bg-ux-background-secondary">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={queuedFile.preview} alt="Menu photo preview" className="w-full max-h-[60vh] object-contain bg-white" />
                        </div>
                        <div className="flex gap-3">
                          <UXButton variant="outline" className="flex-1 bg-white" onClick={() => handleRotate(3)} disabled={rotatingImage}>Rotate left</UXButton>
                          <UXButton variant="outline" className="flex-1 bg-white" onClick={() => handleRotate(1)} disabled={rotatingImage}>Rotate right</UXButton>
                        </div>
                        <UXButton variant="primary" className="w-full" onClick={() => setEditingImage(false)} disabled={rotatingImage}>Done</UXButton>
                      </div>
                    </UXCard>
                  </div>
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
      </div>
    </section>
  )
}
