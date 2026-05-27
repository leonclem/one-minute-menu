'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useToast } from '@/components/ui'
import { UXButton, UXCard } from '@/components/ux'
import type { PhotoGenerationParams, PlatingColour, QuotaStatus } from '@/types'
import { runBatchGenerationSequential, type BatchGenerationItem, type BatchGenerationResult, type BatchProgressUpdate } from '@/lib/batch-generation'

import AngleSelector from './photo-generation/AngleSelector'
import LightingSelector from './photo-generation/LightingSelector'

interface BatchAIImageGenerationProps {
  menuId: string
  items: BatchGenerationItem[]
  onClose: () => void
  onItemImageGenerated: (itemId: string, imageUrl: string, imageId?: string) => Promise<void> | void
}

/** Fallback batch limits (Free plan defaults) */
const DEFAULT_MAX_BATCH_ITEMS = 5
const DEFAULT_DELAY_MS = 3000

export default function BatchAIImageGeneration({ menuId, items, onClose, onItemImageGenerated }: BatchAIImageGenerationProps) {
  const { showToast } = useToast()

  const [params, setParams] = useState<PhotoGenerationParams>({
    angle: '45',
    lighting: 'natural',
    resolution: '1k',
    platingColour: 'beige',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
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
  const [quota, setQuota] = useState<QuotaStatus | null>(null)

  // Plan-based batch limits (fetched on mount)
  const [maxBatchItems, setMaxBatchItems] = useState(DEFAULT_MAX_BATCH_ITEMS)
  const [batchDelayMs, setBatchDelayMs] = useState(DEFAULT_DELAY_MS)

  useEffect(() => {
    fetch('/api/batch-limits')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.maxBatchSize) setMaxBatchItems(data.maxBatchSize)
        if (typeof data?.delayMs === 'number') setBatchDelayMs(data.delayMs)
      })
      .catch(() => { /* use defaults */ })

    fetch('/api/quota')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.success) setQuota(data.data.quota)
      })
      .catch(() => {})
  }, [])

  const totalSelected = items.length
  const itemsToProcess = useMemo(() => items.slice(0, maxBatchItems), [items, maxBatchItems])
  const limitedCount = itemsToProcess.length
  const isLimited = totalSelected > limitedCount

  const total = limitedCount
  const completedCount = useMemo(() => Object.values(progress).filter(s => s === 'completed' || s === 'failed').length, [progress])
  const failedCount = useMemo(() => Object.values(progress).filter(s => s === 'failed').length, [progress])

  const itemIdsToProcess = useMemo(() => items.slice(0, maxBatchItems).map(it => it.id), [items.length, maxBatchItems]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const initial: Record<string, BatchProgressUpdate['status']> = {}
    for (const id of itemIdsToProcess) initial[id] = 'queued'
    setProgress(initial)
  }, [itemIdsToProcess])

  const buildStyleParams = (): PhotoGenerationParams => ({
    angle: params.angle,
    lighting: params.lighting,
    resolution: params.resolution,
    platingColour: params.platingColour,
    // Map to legacy presentation field so the API route continues to work
    presentation: params.angle === 'overhead' ? 'overhead' : params.angle === 'front' ? 'closeup' : 'white_plate',
  } as any)

  const startBatch = async () => {
    setRunning(true)
    setResults(null)
    try {
      if (isLimited) {
        showToast({
          type: 'info',
          title: 'Selection limited',
          description: `You have selected ${totalSelected} items. Generating photos for the first ${limitedCount}.`,
        })
      }

      const batchResults = await runBatchGenerationSequential(menuId, itemsToProcess, {
        styleParams: buildStyleParams(),
        numberOfVariations: 1,
        delayMs: batchDelayMs,
        referenceImages: referenceImages.map(img => ({
          dataUrl: img.dataUrl,
          comment: img.comment,
          name: img.name,
          role: img.role,
        })),
        onProgress: (update) => {
          setProgress(prev => ({ ...prev, [update.itemId]: update.status }))
        },
      })

      for (const r of batchResults) {
        if (r.status === 'success' && r.imageUrl) {
          try {
            const targetId = r.itemIdNormalized || r.itemId
            await onItemImageGenerated(targetId, r.imageUrl, r.imageId)
          } catch {
            // keep result as success
          }
        }
      }

      setResults(batchResults)
      const successes = batchResults.filter(r => r.status === 'success').length
      const failures = batchResults.length - successes

      const quotaExceeded = batchResults.some(r => r.errorCode === 'QUOTA_EXCEEDED')
      const editWindowExpired = batchResults.some(r => r.errorCode === 'EDIT_WINDOW_EXPIRED')

      if (editWindowExpired) {
        const first = batchResults.find(r => r.errorCode === 'EDIT_WINDOW_EXPIRED')
        showToast({ type: 'info', title: 'Edits locked', description: first?.error || 'Your edit window has expired.' })
      } else if (quotaExceeded) {
        showToast({ type: 'info', title: 'Monthly limit reached', description: 'Upgrade to generate more images this month.' })
      } else {
        showToast({ type: failures > 0 ? 'info' : 'success', title: 'Batch complete', description: `${successes} succeeded, ${failures} failed` })
      }
    } catch (e) {
      showToast({ type: 'error', title: 'Batch failed', description: e instanceof Error ? e.message : 'Please try again.' })
    } finally {
      setRunning(false)
    }
  }

  const retryFailed = async () => {
    if (!results) return
    const failedItems = itemsToProcess.filter(it =>
      results.some(r => r.itemId === it.id && r.status === 'failed')
    )
    if (failedItems.length === 0) return

    setRunning(true)
    setProgress(prev => {
      const next = { ...prev }
      for (const it of failedItems) next[it.id] = 'queued'
      return next
    })
    setResults(null)

    try {
      const retryResults = await runBatchGenerationSequential(menuId, failedItems, {
        styleParams: buildStyleParams(),
        numberOfVariations: 1,
        delayMs: batchDelayMs,
        referenceImages: referenceImages.map(img => ({
          dataUrl: img.dataUrl,
          comment: img.comment,
          name: img.name,
          role: img.role,
        })),
        onProgress: (update) => {
          setProgress(prev => ({ ...prev, [update.itemId]: update.status }))
        },
      })

      for (const r of retryResults) {
        if (r.status === 'success' && r.imageUrl) {
          try {
            const targetId = r.itemIdNormalized || r.itemId
            await onItemImageGenerated(targetId, r.imageUrl, r.imageId)
          } catch { /* keep result as success */ }
        }
      }

      setResults(retryResults)
      const successes = retryResults.filter(r => r.status === 'success').length
      const failures = retryResults.length - successes
      showToast({ type: failures > 0 ? 'info' : 'success', title: 'Retry complete', description: `${successes} succeeded, ${failures} failed` })
    } catch (e) {
      showToast({ type: 'error', title: 'Retry failed', description: e instanceof Error ? e.message : 'Please try again.' })
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
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isLimited
                  ? `Create Photos for ${limitedCount} of ${totalSelected} Selected Items`
                  : `Create Photos for ${limitedCount} Selected Items`}
              </h2>
              <p className="text-sm text-secondary-500 mt-0.5">Configure your AI photos</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={running} aria-label="Close">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {isLimited && (
            <div className="mb-6 p-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800">
              You have selected <strong>{totalSelected}</strong> items. The free plan allows batch creation of up to <strong>{limitedCount}</strong> items at a time.{' '}
              <a href="/pricing" className="underline font-medium">Upgrade</a> for larger batches.
            </div>
          )}

          {/* Angle */}
          <div className="mb-6">
            <AngleSelector
              selected={params.angle}
              onChange={(angle) => setParams(prev => ({ ...prev, angle }))}
              disabled={running}
            />
          </div>

          {/* Lighting */}
          <div className="mb-6">
            <LightingSelector
              selected={params.lighting}
              onChange={(lighting) => setParams(prev => ({ ...prev, lighting }))}
              disabled={running}
            />
          </div>

          {/* Advanced Options */}
          <section className="border-t border-secondary-100 pt-4 mb-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-2 text-left group"
              disabled={running}
            >
              <h3 className="text-sm font-bold text-secondary-900 uppercase tracking-wider">Advanced Options</h3>
              <div className="text-secondary-400 group-hover:text-secondary-600 transition-colors">
                {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-6">

                {/* Plating */}
                <div>
                  <h4 className="text-xs font-bold text-secondary-700 uppercase tracking-wider mb-3">Plating</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {([
                      { id: 'white', label: 'White', swatch: 'bg-white border border-secondary-200' },
                      { id: 'beige', label: 'Beige', swatch: 'bg-[#E8DCC8]' },
                      { id: 'black', label: 'Black', swatch: 'bg-secondary-900' },
                      { id: 'wood',  label: 'Wood',  swatch: 'bg-[#8B5E3C]' },
                      { id: 'none',  label: 'None',  swatch: 'bg-secondary-100 border border-dashed border-secondary-300' },
                    ] as const).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={running}
                        onClick={() => setParams(prev => ({ ...prev, platingColour: option.id as PlatingColour }))}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          params.platingColour === option.id
                            ? 'border-[#01B3BF] bg-[#01B3BF]/5'
                            : 'border-secondary-100 hover:border-secondary-200'
                        } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full ${option.swatch} shadow-sm`} />
                        <span className="text-[10px] font-bold text-secondary-600 uppercase tracking-wider">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-secondary-400 mt-2">
                    {params.platingColour === 'none'
                      ? 'No plate specified — dish will be presented without a defined plate.'
                      : params.platingColour === 'black'
                        ? 'Black plate — light marble surface for contrast.'
                        : params.platingColour === 'wood'
                          ? 'Wooden board — rustic serving board presentation.'
                          : `${params.platingColour === 'white' ? 'White' : 'Beige'} plate — dark slate surface for contrast.`
                    }
                  </p>
                </div>

                {/* Resolution */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <h4 className="text-xs font-bold text-secondary-700 uppercase tracking-wider">Resolution</h4>
                    <p className="text-[10px] text-secondary-400 font-medium mt-1">
                      {params.resolution === '4k' ? 'Ultra-high definition (4K) enabled' : 'High-definition (1K) output'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex bg-secondary-100 p-1 rounded-xl">
                      {(['1k', '4k'] as const).map((res) => {
                        const is4k = res === '4k'
                        const isLocked = is4k && quota?.plan === 'free'
                        return (
                          <button
                            key={res}
                            disabled={isLocked || running}
                            onClick={() => setParams(prev => ({ ...prev, resolution: res }))}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              params.resolution === res
                                ? 'bg-white text-secondary-900 shadow-sm'
                                : isLocked
                                  ? 'text-secondary-300 cursor-not-allowed'
                                  : 'text-secondary-400 hover:text-secondary-600'
                            }`}
                          >
                            {res.toUpperCase()}
                            {isLocked && <Zap className="w-3 h-3 fill-secondary-300 text-secondary-300" />}
                          </button>
                        )
                      })}
                    </div>
                    {quota?.plan === 'free' && (
                      <Link href="/pricing" className="text-[9px] text-secondary-400 font-bold uppercase tracking-tight hover:text-secondary-600 transition-colors">
                        Upgrade for <span className="text-[#F8BC02]">4K Resolution</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Reference Photos */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-secondary-700 uppercase tracking-wider">Reference Photos ({referenceImages.length}/3)</h4>
                    {referenceImages.length < 3 && (
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 7 * 1024 * 1024) { showToast({ type: 'error', title: 'File too large', description: 'Max size is 7MB' }); return }
                            const reader = new FileReader()
                            reader.onload = () => {
                              setReferenceImages(prev => [...prev, { id: `upload_${Date.now()}`, dataUrl: reader.result as string, name: file.name, comment: '', role: 'scene' }])
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                        <UXButton variant="outline" size="sm" className="text-xs">Add Photo</UXButton>
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
                              <img src={ref.dataUrl} alt={ref.name} className="w-full h-full object-cover rounded-md border border-gray-100" />
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
                                <button onClick={() => setReferenceImages(prev => prev.filter(r => r.id !== ref.id))} className="text-[10px] text-red-500 hover:text-red-700 font-medium uppercase sm:hidden" disabled={running}>Remove</button>
                              </div>
                              <textarea
                                placeholder="e.g., use this plate, match the lighting, remove herbs"
                                value={ref.comment}
                                onChange={(e) => setReferenceImages(prev => prev.map(r => r.id === ref.id ? { ...r, comment: e.target.value } : r))}
                                className="w-full text-xs p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-ux-primary focus:border-ux-primary resize-none bg-white/80"
                                rows={1}
                                disabled={running}
                              />
                              <div className="hidden sm:flex justify-end">
                                <button onClick={() => setReferenceImages(prev => prev.filter(r => r.id !== ref.id))} className="text-[10px] text-red-500 hover:text-red-700 font-medium uppercase tracking-wider transition-colors" disabled={running}>Remove</button>
                              </div>
                            </div>
                          </div>
                        </UXCard>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-400">No reference photos added.<br />Upload one to guide the generation.</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </section>

          {/* Item list and progress */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Items</h4>
            <div className="space-y-2 max-h-64 overflow-auto">
              {itemsToProcess.map((it, idx) => {
                const status = progress[it.id] || 'queued'
                return (
                  <div key={it.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-xs text-gray-500 w-5 text-right">{idx + 1}</div>
                      <div className="truncate text-sm text-gray-900" title={it.name}>{it.name}</div>
                    </div>
                    <div className="text-xs">
                      {status === 'queued'      && <span className="text-gray-500">Queued</span>}
                      {status === 'processing'  && <span className="text-blue-600">Processing…</span>}
                      {status === 'completed'   && <span className="text-green-600">Completed</span>}
                      {status === 'failed'      && <span className="text-red-600">Failed</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary when done */}
          {results && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-800">
                Completed {completedCount}/{total}.{' '}
                {failedCount > 0
                  ? <span className="text-red-600">Failed {failedCount}.</span>
                  : <span className="text-green-600">All succeeded.</span>
                }
              </div>
              {failedCount > 0 && (
                <div className="mt-2 space-y-1">
                  {results.filter(r => r.status === 'failed').map(r => {
                    const item = itemsToProcess.find(it => it.id === r.itemId)
                    return (
                      <div key={r.itemId} className="text-xs text-red-600 flex items-start gap-1">
                        <span className="font-medium truncate max-w-[200px]">{item?.name ?? r.itemId}:</span>
                        <span className="text-red-500">{r.error || 'Unknown error'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quota */}
          <div className="mb-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${quota ? 'bg-[#01B3BF]' : 'bg-secondary-300'}`} />
            <p className="text-[10px] text-secondary-500 uppercase font-bold tracking-widest">
              {quota ? `${quota.remaining} generations remaining` : 'Syncing quota...'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <UXButton variant="outline" onClick={onClose} disabled={running} className="flex-1">Close</UXButton>
            {results && failedCount > 0 ? (
              <UXButton variant="primary" onClick={retryFailed} loading={running} disabled={running} className="flex-1">
                Retry Failed ({failedCount})
              </UXButton>
            ) : (
              <UXButton
                variant="primary"
                onClick={startBatch}
                loading={running}
                disabled={running || !!results}
                className="flex-1"
              >
                {results ? 'Batch Completed' : (running ? 'Creating…' : 'Create Photos')}
              </UXButton>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}
