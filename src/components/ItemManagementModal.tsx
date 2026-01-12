'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Sparkles } from 'lucide-react'
import type { GeneratedImage, MenuItem, ImageGenerationParams, ImageGenerationJob } from '@/types'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import ImageUpload from '@/components/ImageUpload'
import ZoomableImageModal from '@/components/ZoomableImageModal'

interface ItemManagementModalProps {
  itemId: string
  menuId: string
  itemName?: string
  itemDescription?: string
  itemCategory?: string
  onClose: () => void
  onImageSelected?: (itemId: string, imageUrl: string) => void
}

export default function ItemManagementModal({ 
  itemId, 
  menuId, 
  itemName, 
  itemDescription, 
  itemCategory,
  onClose,
  onImageSelected
}: ItemManagementModalProps) {
  const [loading, setLoading] = useState<'init' | 'select' | 'delete' | 'upload' | 'update' | null>('init')
  const [error, setError] = useState<string | null>(null)
  const [variations, setVariations] = useState<GeneratedImage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  
  // Editing states
  const [editingName, setEditingName] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [nameDraft, setNameDraft] = useState(itemName || '')
  const [descriptionDraft, setDescriptionDraft] = useState(itemDescription || '')
  
  // AI Generation states
  const [generating, setGenerating] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState<'modern' | 'rustic' | 'elegant' | 'casual'>('modern')
  const [generationJob, setGenerationJob] = useState<ImageGenerationJob | null>(null)
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
  
  const { showToast } = useToast()

  const selectedImage = useMemo(() => variations.find(v => v.id === selectedId) || null, [variations, selectedId])
  
  const STYLE_PRESETS = [
    { id: 'modern', name: 'Modern', description: 'Clean, contemporary presentation' },
    { id: 'rustic', name: 'Rustic', description: 'Warm, homestyle appearance' },
    { id: 'elegant', name: 'Elegant', description: 'Sophisticated, fine dining' },
    { id: 'casual', name: 'Casual', description: 'Relaxed, everyday dining' },
  ] as const

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
        // Don't show error for newly created items that might not have variations yet
        if (e?.message !== 'Menu item not found') {
          setError(e?.message || 'Failed to load variations')
        }
      } finally {
        if (mounted) setLoading(null)
      }
    })()
    return () => { mounted = false }
  }, [itemId])

  const updateItemField = async (field: 'name' | 'description', value: string) => {
    setLoading('update')
    setError(null)
    try {
      const response = await fetch(`/api/menus/${menuId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || `Failed to update ${field}`)
      }
      
      showToast({
        type: 'success',
        title: `${field === 'name' ? 'Name' : 'Description'} updated`,
        description: undefined,
      })
      
      if (field === 'name') {
        setEditingName(false)
      } else {
        setEditingDescription(false)
      }
    } catch (error: any) {
      console.error(`Error updating item ${field}:`, error)
      setError(error?.message || `Failed to update ${field}`)
      showToast({
        type: 'error',
        title: 'Update failed',
        description: 'Please try again.',
      })
    } finally {
      setLoading(null)
    }
  }

  const handleNameUpdate = async () => {
    const newName = nameDraft.trim()
    if (!newName || newName === itemName) {
      setEditingName(false)
      setNameDraft(itemName || '')
      return
    }
    await updateItemField('name', newName)
  }

  const handleDescriptionUpdate = async () => {
    const newDescription = descriptionDraft.trim()
    if (newDescription === itemDescription) {
      setEditingDescription(false)
      return
    }
    await updateItemField('description', newDescription)
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
      
      console.log('Image selected successfully:', { itemId, imageId, response: json })
      
      // Notify parent component immediately
      if (onImageSelected) {
        const selectedImage = variations.find(v => v.id === imageId)
        if (selectedImage) {
          onImageSelected(itemId, selectedImage.originalUrl)
        }
      }
      
      // Show success message
      showToast({
        type: 'success',
        title: 'Image selected',
        description: 'This image will now appear as the menu item thumbnail.',
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to select image')
      showToast({
        type: 'error',
        title: 'Selection failed',
        description: 'Please try again.',
      })
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

  const generateAIImage = async () => {
    if (!itemName) {
      showToast({
        type: 'error',
        title: 'Missing item name',
        description: 'Please add a name to this item before generating images.',
      })
      return
    }

    setGenerating(true)
    setError(null)
    
    try {
      const styleParams: ImageGenerationParams = {
        style: selectedStyle,
        presentation: advancedParams.presentation || 'white_plate',
        lighting: advancedParams.lighting || 'natural',
        aspectRatio: '1:1',
        negativePrompt: advancedParams.negativePrompt || '',
        customPromptAdditions: advancedParams.customPromptAdditions || '',
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId,
          menuItemId: itemId,
          itemName: itemName,
          itemDescription: itemDescription,
          category: itemCategory,
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
        } else {
          setError(result.error || 'Failed to start image generation')
          showToast({
            type: 'error',
            title: 'Generation failed',
            description: result.error || 'Please try again.',
          })
        }
        return
      }

      // Check if images were returned directly (synchronous path)
      if (result.data?.images?.length) {
        // Refresh variations to show new images
        const variationsRes = await fetch(`/api/menu-items/${itemId}/variations`)
        const variationsJson = await variationsRes.json()
        if (variationsRes.ok) {
          const newVariations = variationsJson?.data?.variations || []
          setVariations(newVariations)
          
          // Auto-select the most recently generated image
          if (newVariations.length > 0) {
            const mostRecentImage = newVariations[newVariations.length - 1] // Get the most recently generated image
            await selectAiImage(mostRecentImage.id)
          }
        }
        setGenerating(false)
        showToast({
          type: 'success',
          title: 'Images generated',
          description: `Generated ${result.data.images.length} image${result.data.images.length === 1 ? '' : 's'} for ${itemName}`,
        })
      } else if (result.data?.jobId) {
        // Asynchronous path - poll for completion
        const jobId = result.data.jobId
        setGenerationJob(result.data)
        
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/generation-jobs/${jobId}`)
            const statusJson = await statusRes.json()
            
            if (!statusRes.ok) {
              clearInterval(pollInterval)
              throw new Error(statusJson?.error || 'Failed to check generation status')
            }
            
            const job = statusJson.data
            setGenerationJob(job)
            
            if (job.status === 'completed') {
              clearInterval(pollInterval)
              // Refresh variations to show new images
              const variationsRes = await fetch(`/api/menu-items/${itemId}/variations`)
              const variationsJson = await variationsRes.json()
              if (variationsRes.ok) {
                const newVariations = variationsJson?.data?.variations || []
                setVariations(newVariations)
                
                // Auto-select the most recently generated image
                if (newVariations.length > 0) {
                  const mostRecentImage = newVariations[newVariations.length - 1] // Get the most recently generated image
                  await selectAiImage(mostRecentImage.id)
                }
              }
              setGenerating(false)
              showToast({
                type: 'success',
                title: 'Images generated',
                description: `Generated images for ${itemName}`,
              })
            } else if (job.status === 'failed') {
              clearInterval(pollInterval)
              setGenerating(false)
              throw new Error(job.errorMessage || 'Image generation failed')
            }
          } catch (pollError: any) {
            clearInterval(pollInterval)
            setGenerating(false)
            setError(pollError?.message || 'Failed to generate images')
          }
        }, 2000)
      }
      
    } catch (error: any) {
      setGenerating(false)
      setError(error?.message || 'Failed to generate images')
      showToast({
        type: 'error',
        title: 'Generation failed',
        description: error?.message || 'Please try again.',
      })
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-start justify-center p-4">
      <div className="relative my-4 sm:my-8 w-full max-w-4xl bg-white rounded-lg shadow-lg border border-secondary-200 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b flex items-start justify-between gap-3 sticky top-0 bg-white z-20">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  className="flex-1 px-2 py-1 text-base font-semibold bg-white border border-secondary-300 rounded text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={handleNameUpdate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameUpdate()
                    if (e.key === 'Escape') {
                      setEditingName(false)
                      setNameDraft(itemName || '')
                    }
                  }}
                  autoFocus
                  disabled={loading === 'update'}
                />
              </div>
            ) : (
              <div className="group inline-flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-secondary-900 truncate">
                  {nameDraft || itemName || 'Menu Item'}
                </h2>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-secondary-400 hover:text-secondary-600 p-1 rounded"
                  onClick={() => {
                    setNameDraft(itemName || '')
                    setEditingName(true)
                  }}
                  aria-label="Edit item name"
                  disabled={loading === 'update'}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            
            {editingDescription ? (
              <div className="flex items-start gap-2">
                <textarea
                  className="flex-1 px-2 py-1 text-xs text-secondary-600 bg-white border border-secondary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={handleDescriptionUpdate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleDescriptionUpdate()
                    }
                    if (e.key === 'Escape') {
                      setEditingDescription(false)
                      setDescriptionDraft(itemDescription || '')
                    }
                  }}
                  rows={2}
                  autoFocus
                  disabled={loading === 'update'}
                />
              </div>
            ) : (
              <div className="group relative">
                <p className="text-xs text-secondary-600 pr-8">
                  {descriptionDraft || itemDescription || 'Add a description...'}
                </p>
                <button
                  type="button"
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-secondary-400 hover:text-secondary-600 p-1 rounded"
                  onClick={() => {
                    setDescriptionDraft(itemDescription || '')
                    setEditingDescription(true)
                  }}
                  aria-label="Edit item description"
                  disabled={loading === 'update'}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-wrap justify-end">
            <Button 
              variant="primary" 
              size="sm" 
              onClick={generateAIImage} 
              disabled={loading !== null || generating}
              className="flex-shrink-0 text-xs px-2 py-1"
            >
              {generating ? (
                <>
                  <div className="animate-spin mr-1 h-3 w-3 border-b-2 border-white"></div>
                  <span className="hidden sm:inline">Generating...</span>
                  <span className="sm:hidden">Gen...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">{variations.length === 0 ? 'Generate AI Photo' : 'Generate Another'}</span>
                  <span className="sm:hidden">{variations.length === 0 ? 'Generate' : 'Another'}</span>
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowUpload(true)} 
              disabled={loading !== null}
              className="flex-shrink-0 text-xs px-2 py-1"
            >
              <span className="hidden sm:inline">Upload Custom</span>
              <span className="sm:hidden">Upload</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="flex-shrink-0 text-xs px-2 py-1"
            >
              Close
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 text-red-700 text-sm border-b">{error}</div>
        )}



        {/* Generation options and variations */}
        <div className="p-4 space-y-4">
          {loading === 'init' ? (
            <div className="text-sm text-secondary-600">Loading variations…</div>
          ) : (
            <>
              {/* Style selection for generation */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-secondary-900">Choose a style:</div>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_PRESETS.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={`p-2 text-left border rounded transition-colors ${
                        selectedStyle === style.id
                          ? 'border-primary-500 bg-primary-50 text-primary-900'
                          : 'border-secondary-200 hover:border-secondary-300 text-secondary-700'
                      }`}
                      onClick={() => setSelectedStyle(style.id)}
                      disabled={generating}
                    >
                      <div className="font-medium text-sm">{style.name}</div>
                      <div className="text-xs opacity-75">{style.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-sm text-secondary-600 hover:text-secondary-800"
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
                  <div className="mt-3 space-y-3 p-3 bg-secondary-50 rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-secondary-700 mb-1">Lighting</label>
                        <select 
                          className="w-full px-2 py-1.5 border border-secondary-300 rounded text-sm" 
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
                        <label className="block text-xs font-medium text-secondary-700 mb-1">Presentation</label>
                        <select 
                          className="w-full px-2 py-1.5 border border-secondary-300 rounded text-sm" 
                          value={advancedParams.presentation || 'white_plate'} 
                          onChange={(e) => setAdvancedParams(prev => ({ ...prev, presentation: e.target.value as any }))} 
                          disabled={generating}
                        >
                          <option value="white_plate">White plate</option>
                          <option value="wooden_board">Wooden board</option>
                          <option value="overhead">Overhead</option>
                          <option value="closeup">Close-up</option>
                          <option value="bokeh">Shallow focus (Bokeh)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-secondary-700 mb-1">
                        Exclude from image
                      </label>
                      <input
                        type="text"
                        value={advancedParams.negativePrompt || ''}
                        onChange={(e) => setAdvancedParams(prev => ({ 
                          ...prev, 
                          negativePrompt: e.target.value 
                        }))}
                        placeholder="e.g., people, text, utensils"
                        className="w-full px-2 py-1.5 border border-secondary-300 rounded text-sm"
                        disabled={generating}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-secondary-700 mb-1">
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
                        className="w-full px-2 py-1.5 border border-secondary-300 rounded text-sm"
                        disabled={generating}
                      />
                    </div>

                    <div className="border-t border-secondary-200 pt-3 mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-secondary-700">
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
                                }
                                reader.readAsDataURL(file)
                              }}
                            />
                            <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                              + Add Photo
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {referenceImages.length > 0 ? (
                        <div className="space-y-2">
                          {referenceImages.map((ref) => (
                            <div key={ref.id} className="flex flex-col sm:flex-row gap-3 p-2 bg-white border border-secondary-200 rounded-lg shadow-sm">
                              <div className="relative w-full sm:w-16 h-24 sm:h-16 flex-shrink-0">
                                <img 
                                  src={ref.dataUrl} 
                                  alt={ref.name}
                                  className="w-full h-full object-cover rounded-md border border-secondary-100" 
                                />
                                {ref.isPrevious && (
                                  <div className="absolute top-1 left-1 bg-primary-500 text-white text-[7px] px-1 rounded-sm uppercase font-bold">
                                    Previous
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 flex flex-col justify-between gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  <select
                                    value={ref.role}
                                    onChange={(e) => setReferenceImages(prev => prev.map(r => r.id === ref.id ? { ...r, role: e.target.value } : r))}
                                    className="text-[10px] px-1.5 py-0.5 border border-secondary-200 rounded bg-white font-medium text-secondary-700 w-full sm:w-auto"
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
                                    className="text-[9px] text-red-500 hover:text-red-700 font-medium uppercase sm:hidden"
                                    disabled={generating}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="relative flex-1">
                                  <textarea
                                    placeholder="Instruction: e.g., use this bowl"
                                    value={ref.comment}
                                    onChange={(e) => setReferenceImages(prev => prev.map(r => r.id === ref.id ? { ...r, comment: e.target.value } : r))}
                                    className="w-full text-[11px] p-1.5 border border-secondary-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none bg-secondary-50/50"
                                    rows={1}
                                    disabled={generating}
                                  />
                                </div>
                                <div className="hidden sm:flex justify-end">
                                  <button
                                    onClick={() => setReferenceImages(prev => prev.filter(r => r.id !== ref.id))}
                                    className="text-[9px] text-red-500 hover:text-red-700 font-medium uppercase"
                                    disabled={generating}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 border-2 border-dashed border-secondary-200 rounded-lg">
                          <p className="text-[10px] text-secondary-400">
                            No reference photos added.
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
                    <p className="text-sm text-blue-800">
                      {generationJob.status === 'queued' && 'Your image is in the queue...'}
                      {generationJob.status === 'processing' && 'Creating your image...'}
                      {generationJob.status === 'completed' && 'Image generated successfully!'}
                      {generationJob.status === 'failed' && 'Generation failed. Please try again.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Variations grid */}
              {variations.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-secondary-900">Generated images ({variations.length}):</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {variations.map(v => (
                      <div key={v.id} className={`relative border rounded overflow-hidden transition-all ${
                        v.id === selectedId 
                          ? 'ring-2 ring-primary-500 bg-primary-50' 
                          : 'hover:border-secondary-300'
                      }`}>
                        {/* Selected badge */}
                        {v.id === selectedId && (
                          <div className="absolute top-2 left-2 z-10 bg-primary-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                            Selected
                          </div>
                        )}
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={v.thumbnailUrl || v.mobileUrl || v.originalUrl}
                            alt={itemName || 'Variation'}
                            className="w-full h-24 sm:h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            loading="lazy"
                            decoding="async"
                            onClick={() => setPreviewImageUrl(v.originalUrl)}
                          />
                        </div>
                        <div className="p-2 flex items-center gap-1">
                          <Button
                            variant={v.id === selectedId ? "outline" : "primary"}
                            size="sm"
                            onClick={() => selectAiImage(v.id)}
                            disabled={loading === 'select' || v.id === selectedId}
                            className="flex-1 text-[10px] px-1"
                          >
                            {v.id === selectedId ? '✓ Selected' : 'Use This'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addPreviousAsReference(v)}
                            disabled={generating || referenceImages.some(r => r.id === `prev_${v.id}`)}
                            className="flex-1 text-[10px] px-1"
                          >
                            {referenceImages.some(r => r.id === `prev_${v.id}`) ? 'Added' : '+ Ref'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteImage(v.id)}
                            disabled={loading === 'delete'}
                            className="text-xs px-2"
                            aria-label="Delete image"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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

        {previewImageUrl && (
          <ZoomableImageModal
            isOpen={!!previewImageUrl}
            onClose={() => setPreviewImageUrl(null)}
            url={previewImageUrl}
            alt={itemName || 'Item preview'}
          />
        )}
      </div>
    </div>,
    document.body
  )
}
