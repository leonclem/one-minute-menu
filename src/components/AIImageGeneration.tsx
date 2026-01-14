'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/ui'
import { UXButton, UXCard } from '@/components/ux'
import type { MenuItem, ImageGenerationParams, ImageGenerationJob, GeneratedImage } from '@/types'

interface AIImageGenerationProps {
  menuItem: MenuItem
  menuId: string
  onImageGenerated: (itemId: string, imageUrl: string) => void
  onCancel: () => void
}

const STYLE_PRESETS = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary presentation' },
  { id: 'rustic', name: 'Rustic', description: 'Warm, homestyle appearance' },
  { id: 'elegant', name: 'Elegant', description: 'Sophisticated, fine dining' },
  { id: 'casual', name: 'Casual', description: 'Relaxed, everyday dining' },
] as const

export default function AIImageGeneration({ 
  menuItem, 
  menuId, 
  onImageGenerated, 
  onCancel 
}: AIImageGenerationProps) {
  const { showToast } = useToast()
  const [selectedStyle, setSelectedStyle] = useState<string>('modern')
  const [generating, setGenerating] = useState(false)
  const [generationJob, setGenerationJob] = useState<ImageGenerationJob | null>(null)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [previousImages, setPreviousImages] = useState<GeneratedImage[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedParams, setAdvancedParams] = useState<Partial<ImageGenerationParams>>({
    negativePrompt: '',
    customPromptAdditions: '',
    lighting: 'natural',
    presentation: 'white_plate',
  })
  const [referenceImages, setReferenceImages] = useState<Array<{
    id: string
    dataUrl: string
    name: string
    comment: string
    role: string
    isPrevious?: boolean
  }>>([])
  
  const [lastError, setLastError] = useState<{ code?: string; message?: string; suggestions?: string[]; retryAfter?: number; filterReason?: string } | null>(null)

  const stableItemId = menuItem?.id
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        if (!stableItemId) return
        const res = await fetch(`/api/menu-items/${stableItemId}/variations`)
        const json = await res.json()
        if (res.ok && json?.data?.variations && isMounted) {
          setPreviousImages(json.data.variations as GeneratedImage[])
        }
      } catch {
        // best-effort; ignore
      }
    })()
    return () => { isMounted = false }
  }, [stableItemId])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // If the component is rendered without a valid menu item, render nothing
  // Hooks above must always run unconditionally to satisfy rules-of-hooks
  if (!menuItem) {
    return null
  }

  if (!mounted) return null

  const handleGenerateImage = async () => {
    setGenerating(true)
    setLastError(null)
    
    try {
      const styleParams: ImageGenerationParams = {
        style: selectedStyle as any,
        presentation: 'white_plate',
        lighting: 'natural',
        aspectRatio: '1:1',
        hasReferenceImage: referenceImages.length > 0,
        ...advancedParams,
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          menuId,
          menuItemId: stableItemId,
          itemName: menuItem.name,
          itemDescription: menuItem.description,
          category: menuItem.category,
          styleParams,
          numberOfVariations: 1,
          referenceImages: referenceImages.map(img => ({
            dataUrl: img.dataUrl,
            comment: img.comment,
            name: img.name,
            role: img.role
          }))
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.code === 'QUOTA_EXCEEDED') {
          showToast({
            type: 'info',
            title: 'Monthly limit reached',
            description: result.error || 'Upgrade to generate more images this month.',
          })
        } else if (result.code === 'ITEM_DAILY_LIMIT') {
          showToast({
            type: 'info',
            title: 'Daily limit reached for this item',
            description: result.error || 'Try again tomorrow or generate for another item.',
          })
        } else {
          // Store detailed error for inline display with suggestions
          setLastError({ code: result.code, message: result.error, suggestions: result.suggestions, retryAfter: result.retryAfter, filterReason: result.filterReason })
          const title = result.code === 'CONTENT_POLICY_VIOLATION' ? 'Content blocked' : result.code === 'RATE_LIMIT_EXCEEDED' ? 'Rate limited' : 'Generation failed'
          const desc = result.error || 'Please try again.'
          showToast({ type: 'error', title, description: desc })
        }
        return
      }

      // Synchronous path returns images directly
      if (result.data?.images?.length) {
        setGeneratedImages(result.data.images)
      } else if (result.data?.jobId) {
        setGenerationJob(result.data)
        pollJobStatus(result.data.jobId)
      }
      
    } catch (error) {
      console.error('Error generating image:', error)
      showToast({
        type: 'error',
        title: 'Network error',
        description: 'Please check your connection and try again.',
      })
    } finally {
      setGenerating(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/generation-jobs/${jobId}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to check job status')
        }

        const job = result.data.job
        const images = result.data.images || []
        
        setGenerationJob(job)

        if (job.status === 'queued' || job.status === 'processing') {
          setTimeout(poll, 2000) // Poll every 2 seconds
          return
        }

        if (job.status === 'completed' && images.length > 0) {
          setGeneratedImages(images)
        } else if (job.status === 'failed') {
          // If the job failed, display suggestions (if provided by API) and allow retry
          const suggestions: string[] | undefined = result.data?.errorSuggestions
          setLastError({
            code: job.errorCode,
            message: job.errorMessage || 'Generation failed',
            suggestions,
          })
          showToast({
            type: 'error',
            title: 'Generation failed',
            description: job.errorMessage || 'Please try again with different settings.',
          })
        }
      } catch (error) {
        console.error('Error polling job status:', error)
        showToast({
          type: 'error',
          title: 'Status check failed',
          description: 'Please refresh the page to check generation status.',
        })
      }
    }

    await poll()
  }

  const handleSelectImage = async (image: GeneratedImage) => {
    try {
      // Directly apply the generated image URL to the menu item via parent callback
      if (stableItemId) {
        onImageGenerated(stableItemId, image.originalUrl)
      }
      showToast({
        type: 'success',
        title: 'Image selected',
        description: 'Your menu item now has a photo!',
      })
    } catch (error) {
      console.error('❌ [Select Image] Error:', error)
      showToast({
        type: 'error',
        title: 'Selection failed',
        description: 'Please try again.',
      })
    }
  }

  const getStatusMessage = () => {
    if (!generationJob) return ''
    
    switch (generationJob.status) {
      case 'queued':
        return 'Your image is in the queue...'
      case 'processing':
        return 'Creating your image...'
      case 'completed':
        return 'Image generated successfully!'
      case 'failed':
        return 'Generation failed. Please try again.'
      default:
        return ''
    }
  }

  const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const addPreviousAsReference = async (image: GeneratedImage) => {
    if (referenceImages.length >= 3) {
      showToast({
        type: 'info',
        title: 'Maximum reference images reached',
        description: 'You can use up to 3 reference images.'
      })
      return
    }

    try {
      setGenerating(true)
      const dataUrl = await urlToBase64(image.originalUrl)
      setReferenceImages(prev => [
        ...prev,
        {
          id: `prev_${image.id}`,
          dataUrl,
          name: `Previous generation ${image.id.slice(0, 4)}`,
          comment: '',
          role: 'dish',
          isPrevious: true
        }
      ])
      // Auto-switch to "None / Use Reference" when a photo is added
      setAdvancedParams(prev => ({ ...prev, presentation: 'none' }))
      setShowAdvanced(true)
      showToast({
        type: 'success',
        title: 'Image added as reference',
        description: 'You can now provide instructions for this image in advanced options.'
      })
    } catch (error) {
      console.error('Error adding previous image as reference:', error)
      showToast({
        type: 'error',
        title: 'Failed to add reference',
        description: 'Could not process the image. Please try uploading it instead.'
      })
    } finally {
      setGenerating(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-start justify-center p-4">
      <div className="relative my-4 sm:my-8 bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-20 pb-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Create Photo for "{menuItem.name}"
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
              disabled={generating}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!generatedImages.length ? (
            <div className="space-y-6">
              {/* Style Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Choose a style
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedStyle(preset.id)}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${
                        selectedStyle === preset.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={generating}
                    >
                      <div className="font-medium text-gray-900">{preset.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                  disabled={generating}
                >
                  <svg 
                    className={`h-4 w-4 mr-1 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced options (optional)
                </button>
                
                {showAdvanced && (
                  <div className="mt-3 space-y-4 p-4 bg-gray-50 rounded-lg">
                    {/* Aspect ratio removed until API reliably honors it */}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lighting
                        </label>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" 
                          value={advancedParams.lighting || 'natural'} 
                          onChange={(e) => setAdvancedParams(prev => ({ ...prev, lighting: e.target.value as any }))} 
                          disabled={generating}
                        >
                          <option value="natural">Natural</option>
                          <option value="warm">Warm</option>
                          <option value="studio">Studio</option>
                          <option value="cinematic">Cinematic (Dramatic)</option>
                          <option value="golden_hour">Golden Hour</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Presentation
                        </label>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" 
                          value={advancedParams.presentation || 'white_plate'} 
                          onChange={(e) => setAdvancedParams(prev => ({ ...prev, presentation: e.target.value as any }))} 
                          disabled={generating}
                        >
                          <option value="white_plate">White plate</option>
                          <option value="wooden_board">Wooden board</option>
                          <option value="overhead">Overhead</option>
                          <option value="closeup">Close-up</option>
                          <option value="bokeh">Shallow focus (Bokeh)</option>
                          <option value="none">None / Use Reference</option>
                        </select>
                      </div>
                    </div>

                    {advancedParams.presentation === 'none' && referenceImages.length === 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex gap-2">
                          <svg className="h-5 w-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-blue-700">
                            Please add a reference photo below to use this setting, or choose a presentation style above.
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Exclude from image (negative prompt)
                      </label>
                      <input
                        type="text"
                        value={advancedParams.negativePrompt || ''}
                        onChange={(e) => setAdvancedParams(prev => ({ 
                          ...prev, 
                          negativePrompt: e.target.value 
                        }))}
                        placeholder="e.g., people, text, utensils"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={generating}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Specify what you don't want in the image
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional details
                      </label>
                      <input
                        type="text"
                        value={advancedParams.customPromptAdditions || ''}
                        onChange={(e) => setAdvancedParams(prev => ({ 
                          ...prev, 
                          customPromptAdditions: e.target.value 
                        }))}
                        placeholder="e.g., garnished with herbs, served in a bowl"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={generating}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Add specific details about presentation
                      </p>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Reference Photos ({referenceImages.length}/3)
                        </label>
                        {referenceImages.length < 3 && (
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                if (file.size > 7 * 1024 * 1024) {
                                  showToast({ type: 'error', title: 'File too large', description: 'Max size is 7MB' })
                                  return
                                }
                                const reader = new FileReader()
                                reader.onload = () => {
                                  setReferenceImages(prev => [
                                    ...prev,
                                    {
                                      id: `upload_${Date.now()}`,
                                      dataUrl: reader.result as string,
                                      name: file.name,
                                      comment: '',
                                      role: 'scene'
                                    }
                                  ])
                                  // Auto-switch to "None / Use Reference" when a photo is added
                                  setAdvancedParams(prev => ({ ...prev, presentation: 'none' }))
                                }
                                reader.readAsDataURL(file)
                              }}
                            />
                            <UXButton variant="outline" size="sm" className="text-xs">
                              Add Photo
                            </UXButton>
                          </div>
                        )}
                      </div>
                      
                      {referenceImages.length > 0 ? (
                        <div className="space-y-3">
                          {referenceImages.map((ref) => (
                            <UXCard key={ref.id} className="p-3 bg-white/50 backdrop-blur-sm border-ux-border/40">
                              <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative w-full sm:w-16 h-24 sm:h-16 flex-shrink-0">
                                  <img 
                                    src={ref.dataUrl} 
                                    alt={ref.name}
                                    className="w-full h-full object-cover rounded-md border border-gray-100" 
                                  />
                                  {ref.isPrevious && (
                                    <div className="absolute top-1 left-1 bg-ux-primary text-white text-[8px] px-1 rounded-sm uppercase font-bold">
                                      Previous
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 flex flex-col justify-between gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <select
                                      value={ref.role}
                                      onChange={(e) => setReferenceImages(prev => prev.map(r => r.id === ref.id ? { ...r, role: e.target.value } : r))}
                                      className="text-[10px] px-2 py-1 border border-gray-200 rounded bg-white font-medium text-gray-700 w-full sm:w-auto"
                                      disabled={generating}
                                    >
                                      <option value="dish">Dish / Subject</option>
                                      <option value="scene">Table / Scene</option>
                                      <option value="style">Style / Lighting</option>
                                      <option value="layout">Plating / Layout</option>
                                      <option value="other">Other</option>
                                    </select>
                                    <button
                                      onClick={() => setReferenceImages(prev => prev.filter(r => r.id !== ref.id))}
                                      className="text-[10px] text-red-500 hover:text-red-700 font-medium uppercase sm:hidden"
                                      disabled={generating}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="relative flex-1">
                                    <textarea
                                      placeholder="e.g., use this plate, match the lighting, remove herbs"
                                      value={ref.comment}
                                      onChange={(e) => setReferenceImages(prev => prev.map(r => r.id === ref.id ? { ...r, comment: e.target.value } : r))}
                                      className="w-full text-xs p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-ux-primary focus:border-ux-primary resize-none bg-white/80"
                                      rows={1}
                                      disabled={generating}
                                    />
                                  </div>
                                  <div className="hidden sm:flex justify-end">
                                    <button
                                      onClick={() => setReferenceImages(prev => prev.filter(r => r.id !== ref.id))}
                                      className="text-[10px] text-red-500 hover:text-red-700 font-medium uppercase tracking-wider transition-colors"
                                      disabled={generating}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </UXCard>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                          <p className="text-xs text-gray-400">
                            No reference photos added.<br/>
                            Upload one or use a previous generation.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Generation Status */}
              {generationJob && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    {generationJob.status === 'processing' || generationJob.status === 'queued' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                    ) : null}
                    <p className="text-sm text-blue-800">{getStatusMessage()}</p>
                  </div>
                </div>
              )}

              {/* Inline error with suggestions and retry */}
              {lastError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm text-red-800 font-medium mb-1">{lastError.message || 'Generation failed'}</div>
                  {lastError.filterReason && (
                    <div className="text-xs text-red-700 mb-2">Reason: {lastError.filterReason}</div>
                  )}
                  {lastError.suggestions && lastError.suggestions.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-red-800 space-y-1">
                      {lastError.suggestions.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex gap-2">
                    <UXButton
                      variant="primary"
                      size="sm"
                      onClick={handleGenerateImage}
                      disabled={generating}
                    >
                      Retry Now
                    </UXButton>
                    {typeof lastError.retryAfter === 'number' && lastError.retryAfter > 0 && (
                      <span className="text-xs text-red-700 self-center">Try again in ~{Math.ceil(lastError.retryAfter)}s</span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <UXButton
                  variant="outline"
                  onClick={onCancel}
                  disabled={generating}
                  className="flex-1"
                >
                  Cancel
                </UXButton>
                <UXButton
                  variant="primary"
                  onClick={handleGenerateImage}
                  loading={generating}
                  disabled={generating || (advancedParams.presentation === 'none' && referenceImages.length === 0)}
                  className="flex-1"
                >
                  {generating ? 'Creating...' : 'Create Photo'}
                </UXButton>
              </div>
            </div>
          ) : (
            /* Generated Images Display */
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Newly generated image
                </h3>
                <p className="text-sm text-gray-600">
                  Click "Use This Photo" to add it to your menu item
                </p>
              </div>

              {generatedImages.map((image) => (
                <div key={image.id} className="border rounded-lg overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.originalUrl}
                    alt={`Generated image for ${menuItem.name}`}
                    className="w-full h-auto object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="p-4 flex gap-3">
                    <UXButton
                      variant="primary"
                      onClick={() => handleSelectImage(image)}
                      className="flex-1"
                    >
                      Use This Photo
                    </UXButton>
                    <UXButton
                      variant="outline"
                      onClick={() => {
                        // Preserve current images for comparison and allow regeneration
                        setPreviousImages(prev => {
                          const map = new Map<string, GeneratedImage>()
                          ;[...prev, ...generatedImages].forEach(img => map.set(img.id, img))
                          return Array.from(map.values())
                        })
                        setGeneratedImages([])
                        setGenerationJob(null)
                      }}
                      className="flex-1"
                    >
                      Try Again
                    </UXButton>
                  </div>
                </div>
              ))}

              {/* Previous images section */}
              {previousImages.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Previous images</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {previousImages.map((image) => (
                      <div key={image.id} className="border rounded-lg overflow-hidden bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.thumbnailUrl || image.originalUrl}
                          alt={`Previous generated for ${menuItem.name}`}
                          className="w-full h-auto object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="p-3 space-y-2">
                          <UXButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleSelectImage(image)}
                            className="w-full"
                          >
                            Use This Photo
                          </UXButton>
                          <UXButton
                            variant="outline"
                            size="sm"
                            onClick={() => addPreviousAsReference(image)}
                            className="w-full text-xs"
                            disabled={generating || referenceImages.some(r => r.id === `prev_${image.id}`)}
                          >
                            {referenceImages.some(r => r.id === `prev_${image.id}`) ? 'Added to References' : 'Add as Reference'}
                          </UXButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}