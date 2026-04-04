'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui'
import { Button } from '@/components/ui'
import type { PhotoGenerationParams, QuotaStatus } from '@/types'
import { runBatchGenerationSequential, type BatchGenerationItem, type BatchGenerationResult, type BatchProgressUpdate } from '@/lib/batch-generation'
import AngleSelector from './photo-generation/AngleSelector'
import LightingSelector from './photo-generation/LightingSelector'
import SettingReferenceSlot from './photo-generation/SettingReferenceSlot'

interface BatchPhotoModalProps {
  menuId: string
  items: BatchGenerationItem[]
  onClose: () => void
  onItemImageGenerated: (itemId: string, imageUrl: string, imageId?: string) => Promise<void> | void
}

/** Fallback batch limits (Free plan defaults) */
const DEFAULT_MAX_BATCH_ITEMS = 5
const DEFAULT_DELAY_MS = 3000

export default function BatchPhotoModal({ menuId, items, onClose, onItemImageGenerated }: BatchPhotoModalProps) {
  const { showToast } = useToast()
  const [params, setParams] = useState<PhotoGenerationParams>({
    angle: '45',
    lighting: 'natural',
    resolution: '1k'
  })
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Record<string, BatchProgressUpdate['status']>>({})
  const [results, setResults] = useState<BatchGenerationResult[] | null>(null)

  // Plan-based batch limits
  const [maxBatchItems, setMaxBatchItems] = useState(DEFAULT_MAX_BATCH_ITEMS)
  const [batchDelayMs, setBatchDelayMs] = useState(DEFAULT_DELAY_MS)

  useEffect(() => {
    fetch('/api/batch-limits')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.maxBatchSize) setMaxBatchItems(data.maxBatchSize)
        if (typeof data?.delayMs === 'number') setBatchDelayMs(data.delayMs)
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

  const total = limitedCount
  const completedCount = useMemo(() => Object.values(progress).filter(s => s === 'completed' || s === 'failed').length, [progress])
  const failedCount = useMemo(() => Object.values(progress).filter(s => s === 'failed').length, [progress])

  const itemIdsToProcess = useMemo(() => itemsToProcess.map(it => it.id), [itemsToProcess])

  useEffect(() => {
    const initial: Record<string, BatchProgressUpdate['status']> = {}
    for (const id of itemIdsToProcess) initial[id] = 'queued'
    setProgress(initial)
  }, [itemIdsToProcess])

  const startBatch = async () => {
    setRunning(true)
    setResults(null)
    try {
      const styleParams = {
        angle: params.angle,
        lighting: params.lighting,
        resolution: params.resolution,
        presentation: params.angle === 'overhead' ? 'overhead' : params.angle === 'front' ? 'closeup' : 'white_plate'
      }

      if (isLimited) {
        showToast({
          type: 'info',
          title: 'Selection limited',
          description: `Generating photos for the first ${limitedCount} items.`,
        })
      }

      const batchResults = await runBatchGenerationSequential(menuId, itemsToProcess, {
        styleParams: styleParams as any,
        numberOfVariations: 1,
        delayMs: batchDelayMs,
        referenceImages: params.settingReferenceImage ? [{
          dataUrl: params.settingReferenceImage,
          comment: '',
          role: 'scene',
          name: 'Setting'
        }] : [],
        onProgress: (update) => {
          setProgress(prev => ({ ...prev, [update.itemId]: update.status }))
        },
      })

      for (const r of batchResults) {
        if (r.status === 'success' && r.imageUrl) {
          try {
            const targetId = r.itemIdNormalized || r.itemId
            await onItemImageGenerated(targetId, r.imageUrl, r.imageId)
          } catch {}
        }
      }

      setResults(batchResults)
      const successes = batchResults.filter(r => r.status === 'success').length
      const failures = batchResults.length - successes

      showToast({
        type: failures > 0 ? 'info' : 'success',
        title: 'Batch complete',
        description: `${successes} succeeded, ${failures} failed`
      })
    } catch (e) {
      showToast({ type: 'error', title: 'Batch failed', description: e instanceof Error ? e.message : 'Please try again.' })
    } finally {
      setRunning(false)
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); return () => setMounted(false) }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm" onClick={onClose} />
      
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
            {!results && (
              <Button
                variant="primary"
                onClick={startBatch}
                disabled={running || !!(quota && quota.remaining < limitedCount)}
                className="rounded-full px-6 bg-[#01B3BF] hover:bg-[#01B3BF]/90"
              >
                {running ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    <span>Creating...</span>
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
          {!results ? (
            <>
              <AngleSelector selected={params.angle} onChange={(angle) => setParams(prev => ({ ...prev, angle }))} disabled={running} />
              <LightingSelector selected={params.lighting} onChange={(lighting) => setParams(prev => ({ ...prev, lighting }))} disabled={running} />
              <SettingReferenceSlot value={params.settingReferenceImage} onChange={(dataUrl) => setParams(prev => ({ ...prev, settingReferenceImage: dataUrl }))} disabled={running} />
              
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
            <section className="text-center py-12">
              <div className="w-20 h-20 bg-[#01B3BF]/5 text-[#01B3BF] rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-secondary-900 mb-2">Batch Complete!</h3>
              <p className="text-secondary-500 mb-8">
                Generated {completedCount - failedCount} photos successfully.
                {failedCount > 0 && ` ${failedCount} items failed.`}
              </p>
              <Button variant="outline" onClick={onClose} className="rounded-full px-8">
                Back to Menu
              </Button>
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
