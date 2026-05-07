'use client'

import { useCallback, useEffect, useState } from 'react'

export type ImageGenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type ImageGenerationJobSummary = {
  id: string
  batchId: string | null
  menuId: string | null
  menuItemId: string
  status: ImageGenerationJobStatus
  numberOfVariations: number
  resultCount: number
  errorMessage: string | null
  errorCode: string | null
  retryCount: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export type CutoutStatus = 'not_requested' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'timed_out'

export type GeneratedImageSummary = {
  id: string
  menuItemId: string
  desktopUrl: string | null
  cutoutUrl: string | null
  cutoutStatus: CutoutStatus
  selected: boolean
  createdAt: string
}

export type ImageGenerationStatusData = {
  menuId: string
  hasActiveJobs: boolean
  activeCount: number
  hasActiveCutouts?: boolean
  activeCutoutCount?: number
  jobs: ImageGenerationJobSummary[]
  activeJobs: ImageGenerationJobSummary[]
  failedJobs?: ImageGenerationJobSummary[]
  recentCompletedJobs?: ImageGenerationJobSummary[]
  jobsByItem?: Record<string, ImageGenerationJobSummary[]>
  activeByItem?: Record<string, ImageGenerationJobSummary[]>
  failedByItem?: Record<string, ImageGenerationJobSummary[]>
  recentCompletedByItem?: Record<string, ImageGenerationJobSummary[]>
  latestByItem: Record<string, ImageGenerationJobSummary>
  images?: GeneratedImageSummary[]
  imageByItem?: Record<string, GeneratedImageSummary>
  activeCutoutImages?: GeneratedImageSummary[]
}

type StatusResponse = {
  success?: boolean
  data?: ImageGenerationStatusData
  error?: string
}

export function isActiveImageGenerationJob(job?: Pick<ImageGenerationJobSummary, 'status'> | null): boolean {
  return job?.status === 'queued' || job?.status === 'processing'
}

export function getImageGenerationJobLabel(job?: Pick<ImageGenerationJobSummary, 'status'> | null): string | null {
  if (!job) return null
  if (job.status === 'queued') return 'Queued'
  if (job.status === 'processing') return 'Generating'
  if (job.status === 'failed') return 'Failed'
  if (job.status === 'completed') return 'Completed'
  return null
}

export function isActiveCutoutStatus(status?: CutoutStatus | null): boolean {
  return status === 'pending' || status === 'processing'
}

export function useImageGenerationStatus(menuId: string, enabled = true) {
  const [data, setData] = useState<ImageGenerationStatusData | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled || !menuId || menuId.startsWith('demo-')) return null

    try {
      setError(null)
      const response = await fetch(`/api/menus/${menuId}/image-generation-status`, {
        cache: 'no-store',
      })
      const json = await response.json().catch(() => ({})) as StatusResponse

      if (!response.ok || !json.data) {
        throw new Error(json.error || 'Failed to fetch image generation status')
      }

      setData(json.data)
      return json.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch image generation status')
      return null
    } finally {
      setLoading(false)
    }
  }, [enabled, menuId])

  useEffect(() => {
    if (!enabled || !menuId || menuId.startsWith('demo-')) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    refresh()
  }, [enabled, menuId, refresh])

  useEffect(() => {
    if (!enabled || (!data?.hasActiveJobs && !data?.hasActiveCutouts)) return

    const interval = window.setInterval(() => {
      refresh()
    }, 6000)

    return () => window.clearInterval(interval)
  }, [data?.hasActiveCutouts, data?.hasActiveJobs, enabled, refresh])

  return {
    data,
    loading,
    error,
    refresh,
  }
}
