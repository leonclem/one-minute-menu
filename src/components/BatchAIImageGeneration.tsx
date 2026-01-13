'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/ui'
import { UXButton, UXCard } from '@/components/ux'
import type { ImageGenerationParams } from '@/types'
import { runBatchGenerationSequential, type BatchGenerationItem, type BatchGenerationResult, type BatchProgressUpdate } from '@/lib/batch-generation'

interface BatchAIImageGenerationProps {
  menuId: string
  items: BatchGenerationItem[]
  onClose: () => void
  onItemImageGenerated: (itemId: string, imageUrl: string) => Promise<void> | void
}

const STYLE_PRESETS = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary presentation' },
  { id: 'rustic', name: 'Rustic', description: 'Warm, homestyle appearance' },
  { id: 'elegant', name: 'Elegant', description: 'Sophisticated, fine dining' },
  { id: 'casual', name: 'Casual', description: 'Relaxed, everyday dining' },
] as const

export default function BatchAIImageGeneration({ menuId, items, onClose, onItemImageGenerated }: BatchAIImageGenerationProps) {
  const { showToast } = useToast()
  const [selectedStyle, setSelectedStyle] = useState<string>('modern')
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
  }>>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Record<string, BatchProgressUpdate['status']>>({})
  const [results, setResults] = useState<BatchGenerationResult[] | null>(null)

  const total = items.length
  const completedCount = useMemo(() => Object.values(progress).filter(s => s === 'completed' || s === 'failed').length, [progress])
  const failedCount = useMemo(() => Object.values(progress).filter(s => s === 'failed').length, [progress])

  useEffect(() => {
    // Initialize progress map
    const initial: Record<string, BatchProgressUpdate['status']> = {}
    for (const it of items) initial[it.id] = 'queued'
    setProgress(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startBatch = async () => {
    setRunning(true)
    setResults(null)
    try {
      const styleParams: ImageGenerationParams = {
        style: selectedStyle as any,
        presentation: advancedParams.presentation || 'white_plate',
        lighting: advancedParams.lighting || 'natural',
        negativePrompt: advancedParams.negativePrompt || '',
        customPromptAdditions: advancedParams.customPromptAdditions || '',
      }

      const batchResults = await runBatchGenerationSequential(menuId, items, {
        styleParams,
        numberOfVariations: 1,
        referenceImages: referenceImages.map(img => ({
          dataUrl: img.dataUrl,
          comment: img.comment,
          name: img.name,
          role: img.role
        })),
        onProgress: (update) => {
          setProgress(prev => ({ ...prev, [update.itemId]: update.status }))
        },
      })

      // Apply successful images to items
      for (const r of batchResults) {
        if (r.status === 'success' && r.imageUrl) {
          try {
            const targetId = r.itemIdNormalized || r.itemId
            await onItemImageGenerated(targetId, r.imageUrl)
          } catch {
            // If updating item fails, keep result as success but user will see image later
          }
        }
      }

      setResults(batchResults)
      const successes = batchResults.filter(r => r.status === 'success').length
      const failures = batchResults.length - successes
      
      // Check if batch stopped due to quota exceeded
      const quotaExceeded = batchResults.some(r => r.errorCode === 'QUOTA_EXCEEDED')
      
      if (quotaExceeded) {
        showToast({ 
          type: 'info', 
          title: 'Monthly limit reached', 
          description: 'Upgrade to generate more images this month.' 
        })
      } else {
        showToast({ 
          type: failures > 0 ? 'info' : 'success', 
          title: 'Batch complete', 
          description: `${successes} succeeded, ${failures} failed` 
        })
      }
    } catch (e) {
      showToast({ type: 'error', title: 'Batch failed', description: e instanceof Error ? e.message : 'Please try again.' })
    } finally {
      setRunning(false)
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Create Photos for {items.length} Selected Items</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={running} aria-label="Close">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Style Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Choose a style</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedStyle(preset.id)}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${selectedStyle === preset.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  disabled={running}
                >
                  <div className="font-medium text-gray-900 text-sm">{preset.name}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Options */}
          <div className="mb-6">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center text-sm text-gray-600 hover:text-gray-800" disabled={running}>
              <svg className={`h-4 w-4 mr-1 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              Advanced options (optional)
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exclude from image (negative prompt)</label>
                  <input type="text" value={advancedParams.negativePrompt || ''} onChange={(e) => setAdvancedParams(prev => ({ ...prev, negativePrompt: e.target.value }))} placeholder="e.g., people, text, utensils" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" disabled={running} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional details</label>
                  <input type="text" value={advancedParams.customPromptAdditions || ''} onChange={(e) => setAdvancedParams(prev => ({ ...prev, customPromptAdditions: e.target.value }))} placeholder="e.g., garnished with herbs, served in a bowl" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" disabled={running} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lighting</label>
                    <select className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" value={advancedParams.lighting || 'natural'} onChange={(e) => setAdvancedParams(prev => ({ ...prev, lighting: e.target.value as any }))} disabled={running}>
                      <option value="natural">Natural</option>
                      <option value="warm">Warm</option>
                      <option value="studio">Studio</option>
                      <option value="cinematic">Cinematic (Dramatic)</option>
                      <option value="golden_hour">Golden Hour</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Presentation</label>
                    <select className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" value={advancedParams.presentation || 'white_plate'} onChange={(e) => setAdvancedParams(prev => ({ ...prev, presentation: e.target.value as any }))} disabled={running}>
                      <option value="white_plate">White plate</option>
                      <option value="wooden_board">Wooden board</option>
                      <option value="overhead">Overhead</option>
                      <option value="closeup">Close-up</option>
                      <option value="bokeh">Shallow focus (Bokeh)</option>
                    </select>
                  </div>
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
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={ref.dataUrl} 
                                alt={ref.name}
                                className="w-full h-full object-cover rounded-md border border-gray-100" 
                              />
                            </div>
                            <div className="flex-1 flex flex-col justify-between gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <select
                                  value={ref.role}
                                  onChange={(e) => setReferenceImages(prev => prev.map(r => r.id === ref.id ? { ...r, role: e.target.value } : r))}
                                  className="text-[10px] px-2 py-1 border border-gray-200 rounded bg-white font-medium text-gray-700 w-full sm:w-auto"
                                  disabled={running}
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
                                  disabled={running}
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
                                  disabled={running}
                                />
                              </div>
                              <div className="hidden sm:flex justify-end">
                                <button
                                  onClick={() => setReferenceImages(prev => prev.filter(r => r.id !== ref.id))}
                                  className="text-[10px] text-red-500 hover:text-red-700 font-medium uppercase tracking-wider transition-colors"
                                  disabled={running}
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
                        Upload one to guide the generation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Item list and progress */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Items</h4>
            <div className="space-y-2 max-h-64 overflow-auto">
              {items.map((it, idx) => {
                const status = progress[it.id] || 'queued'
                return (
                  <div key={it.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-xs text-gray-500 w-5 text-right">{idx + 1}</div>
                      <div className="truncate text-sm text-gray-900" title={it.name}>{it.name}</div>
                    </div>
                    <div className="text-xs">
                      {status === 'queued' && <span className="text-gray-500">Queued</span>}
                      {status === 'processing' && <span className="text-blue-600">Processing…</span>}
                      {status === 'completed' && <span className="text-green-600">Completed</span>}
                      {status === 'failed' && <span className="text-red-600">Failed</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary when done */}
          {results && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-800">Completed {completedCount}/{total}. Failed {failedCount}.</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <UXButton variant="outline" onClick={onClose} disabled={running} className="flex-1">Close</UXButton>
            <UXButton 
              variant="primary" 
              onClick={startBatch} 
              loading={running} 
              disabled={running || !!results}
              className="flex-1"
            >
              {results ? 'Batch Completed' : (running ? 'Creating…' : 'Create Photos')}
            </UXButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}


