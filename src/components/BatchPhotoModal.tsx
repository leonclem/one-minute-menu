'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Sparkles, X, Zap } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui'
import { Button } from '@/components/ui'
import type { PhotoGenerationParams, PlatingColour, QuotaStatus } from '@/types'
import type { BatchGenerationItem } from '@/lib/batch-generation'
import {
  getImageGenerationJobLabel,
  useImageGenerationStatus,
  type ImageGenerationJobStatus,
} from '@/lib/image-generation/use-image-generation-status'
import AngleSelector from './photo-generation/AngleSelector'
import LightingSelector from './photo-generation/LightingSelector'
import SettingReferenceSlot from './photo-generation/SettingReferenceSlot'

interface BatchPhotoModalProps {
  menuId: string
  items: BatchGenerationItem[]
  onClose: () => void
}

/** Fallback batch limits (Free plan defaults) */
const DEFAULT_MAX_BATCH_ITEMS = 5

type SubmittedBatchJob = {
  id: string
  itemId: string
  itemName: string
  menuItemId: string
  status: ImageGenerationJobStatus
}

export default function BatchPhotoModal({ menuId, items, onClose }: BatchPhotoModalProps) {
  const { showToast } = useToast()
  const [params, setParams] = useState<PhotoGenerationParams>({
    angle: '45',
    lighting: 'natural',
    resolution: '1k',
    platingColour: 'beige',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Record<string, ImageGenerationJobStatus>>({})
  const [submittedJobs, setSubmittedJobs] = useState<SubmittedBatchJob[] | null>(null)

  // Plan-based batch limits
  const [maxBatchItems, setMaxBatchItems] = useState(DEFAULT_MAX_BATCH_ITEMS)
  const {
    data: imageGenerationStatus,
  } = useImageGenerationStatus(menuId, !!submittedJobs)

  useEffect(() => {
    fetch('/api/batch-limits')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.maxBatchSize) setMaxBatchItems(data.maxBatchSize)
      })
      .catch(() => {})

    fetch('/api/quota')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.success && json?.data?.quota) {
          setQuota(json.data.quota)
        }
      })
      .catch(() => {})
  }, [])

  const totalSelected = items.length
  const itemsToProcess = useMemo(() => items.slice(0, maxBatchItems), [items, maxBatchItems])
  const limitedCount = itemsToProcess.length
  const isLimited = totalSelected > limitedCount

  const completedCount = useMemo(() => Object.values(progress).filter(s => s === 'completed').length, [progress])
  const failedCount = useMemo(() => Object.values(progress).filter(s => s === 'failed').length, [progress])
  const activeCount = useMemo(() => Object.values(progress).filter(s => s === 'queued' || s === 'processing').length, [progress])

  const itemIdsToProcess = useMemo(() => itemsToProcess.map(it => it.id), [itemsToProcess])

  useEffect(() => {
    if (submittedJobs) return

    const initial: Record<string, ImageGenerationJobStatus> = {}
    for (const id of itemIdsToProcess) initial[id] = 'queued'
    setProgress(initial)
  }, [itemIdsToProcess, submittedJobs])

  useEffect(() => {
    if (!submittedJobs) return

    setProgress(prev => {
      const next: Record<string, ImageGenerationJobStatus> = {}
      for (const job of submittedJobs) {
        const latestJob = imageGenerationStatus?.latestByItem[job.menuItemId]
        next[job.itemId] = latestJob?.status || prev[job.itemId] || job.status
      }
      return next
    })
  }, [imageGenerationStatus, submittedJobs])

  const startBatch = async () => {
    setRunning(true)
    try {
      const styleParams = {
        angle: params.angle,
        lighting: params.lighting,
        resolution: params.resolution,
        platingColour: params.platingColour,
        presentation: params.angle === 'overhead' ? 'overhead' : params.angle === 'front' ? 'closeup' : 'white_plate'
      }

      if (isLimited) {
        showToast({
          type: 'info',
          title: 'Selection limited',
          description: `Generating photos for the first ${limitedCount} items.`,
        })
      }

      const response = await fetch('/api/image-generation/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId,
          itemIds: itemIdsToProcess,
          styleParams,
          numberOfVariations: 1,
          referenceImages: params.settingReferenceImage ? [{
            dataUrl: params.settingReferenceImage,
            comment: '',
            role: 'scene',
            name: 'Setting'
          }] : [],
        }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to start batch image generation')
      }

      const jobs = Array.isArray(json?.data?.jobs) ? json.data.jobs : []
      if (jobs.length === 0) {
        throw new Error('No image generation jobs were queued')
      }

      const submitted: SubmittedBatchJob[] = jobs.map((job: any, index: number): SubmittedBatchJob => {
        const item = itemsToProcess[index] || itemsToProcess.find(candidate => candidate.id === job.menuItemId)
        return {
          id: job.id,
          itemId: item?.id || job.menuItemId,
          itemName: item?.name || 'Menu item',
          menuItemId: job.menuItemId,
          status: job.status || 'queued',
        }
      })

      setSubmittedJobs(submitted)
      const initialProgress: Record<string, ImageGenerationJobStatus> = {}
      submitted.forEach((job) => {
        initialProgress[job.itemId] = job.status
      })
      setProgress(initialProgress)
      if (json?.data?.quota) setQuota(json.data.quota)

      showToast({
        type: 'success',
        title: 'Batch started',
        description: `${submitted.length} photo${submitted.length === 1 ? '' : 's'} queued for background generation.`
      })
    } catch (e) {
      showToast({ type: 'error', title: 'Batch could not start', description: e instanceof Error ? e.message : 'Please try again.' })
    } finally {
      setRunning(false)
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); return () => setMounted(false) }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm" onClick={running ? undefined : onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-secondary-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-secondary-900 truncate">Batch Create Photos</h2>
            <p className="text-sm text-secondary-500 line-clamp-1 mt-0.5">
              {limitedCount} items selected
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!submittedJobs && (
              <Button
                variant="primary"
                onClick={startBatch}
                disabled={running || !!(quota && quota.remaining < limitedCount)}
                className="rounded-full px-6 bg-[#01B3BF] hover:bg-[#01B3BF]/90"
              >
                {running ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    <span>Starting...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Start Batch</span>
                  </div>
                )}
              </Button>
            )}
            <button 
              onClick={onClose}
              disabled={running}
              className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-50 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {!submittedJobs ? (
            <>
              <AngleSelector selected={params.angle} onChange={(angle) => setParams(prev => ({ ...prev, angle }))} disabled={running} />
              <LightingSelector selected={params.lighting} onChange={(lighting) => setParams(prev => ({ ...prev, lighting }))} disabled={running} />
              <SettingReferenceSlot value={params.settingReferenceImage} onChange={(dataUrl) => setParams(prev => ({ ...prev, settingReferenceImage: dataUrl }))} disabled={running} />

              {/* Advanced Options */}
              <section className="border-t border-secondary-100 pt-4">
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
                  </div>
                )}
              </section>
              
              <section>
                <h3 className="text-sm font-bold text-secondary-900 uppercase tracking-wider mb-4">Items in this batch</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {itemsToProcess.map((it, idx) => (
                    <div key={it.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary-50 border border-secondary-100">
                      <span className="text-[10px] font-bold text-secondary-400 w-4">{idx + 1}</span>
                      <span className="text-sm text-secondary-700 truncate">{it.name}</span>
                      <div className="ml-auto">
                        {progress[it.id] === 'processing' && <div className="animate-spin h-3 w-3 border-2 border-[#01B3BF]/30 border-t-[#01B3BF] rounded-full" />}
                        {progress[it.id] === 'completed' && <span className="text-[#01B3BF] text-xs font-bold">✓</span>}
                        {progress[it.id] === 'failed' && <span className="text-red-500 text-xs font-bold">!</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="space-y-6">
              <div className="rounded-2xl border border-[#01B3BF]/20 bg-[#01B3BF]/5 p-5">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#01B3BF]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-secondary-900">Batch generation has started</h3>
                    <p className="mt-2 text-sm leading-6 text-secondary-600">
                      Your photos are now being generated in the background. This may take several minutes,
                      cannot be cancelled, and the completed images should be reviewed before exporting your menu.
                    </p>
                    <p className="mt-3 text-sm font-medium text-secondary-700">
                      You can close this window or navigate away while generation continues.
                    </p>
                  </div>
                </div>
              </div>

              <section>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-secondary-900">Job progress</h3>
                    <p className="mt-1 text-xs text-secondary-500">
                      {completedCount} of {submittedJobs.length} complete, {activeCount} active{failedCount > 0 ? `, ${failedCount} failed` : ''}
                    </p>
                  </div>
                  <Button variant="outline" onClick={onClose} className="rounded-full px-5">
                    Close
                  </Button>
                </div>

                <div className="space-y-2">
                  {submittedJobs.map((job, idx) => {
                    const status = progress[job.itemId] || job.status
                    const label = getImageGenerationJobLabel({ status }) || 'Queued'
                    return (
                      <div key={job.id} className="flex items-center gap-3 rounded-lg border border-secondary-100 bg-white p-3">
                        <span className="w-5 text-[10px] font-bold text-secondary-400">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-secondary-800">{job.itemName}</p>
                          <p className="text-xs text-secondary-500">{label}</p>
                        </div>
                        {status === 'queued' && <Clock className="h-4 w-4 text-secondary-400" />}
                        {status === 'processing' && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#01B3BF]/30 border-t-[#01B3BF]" />}
                        {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-[#01B3BF]" />}
                        {status === 'failed' && <span className="text-sm font-bold text-red-500">!</span>}
                      </div>
                    )
                  })}
                </div>
              </section>
            </section>
          )}
        </div>

        {/* Footer Quota */}
        <div className="px-6 py-4 bg-secondary-50 border-t border-secondary-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${quota ? 'bg-[#01B3BF]' : 'bg-secondary-300'}`} />
            <p className="text-[10px] text-secondary-500 uppercase font-bold tracking-widest">
              {quota ? `${quota.remaining} generations remaining` : 'Syncing quota...'}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
