'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { StudioDishExportShot } from '@/lib/studio/types'

const POLL_INTERVAL_MS = 6000

interface DishExportsResponse {
  shots?: StudioDishExportShot[]
  pending?: boolean
}

export function useStudioDishExports(dishId: string) {
  const [shots, setShots] = useState<StudioDishExportShot[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio/exports?dishId=${encodeURIComponent(dishId)}`)
      if (!res.ok) throw new Error('Failed to load exports')
      const data = (await res.json()) as DishExportsResponse
      setShots(data.shots ?? [])
      setPending(Boolean(data.pending))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exports')
    } finally {
      setLoaded(true)
    }
  }, [dishId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pendingRef = useRef(pending)
  pendingRef.current = pending

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => {
      if (pendingRef.current) void refresh()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [pending, refresh])

  const replaceShotTiles = useCallback((imageId: string, tiles: StudioDishExportShot['tiles'], nextPending?: boolean) => {
    setShots((prev) =>
      prev.map((shot) => (shot.imageId === imageId ? { ...shot, tiles } : shot)),
    )
    if (typeof nextPending === 'boolean') setPending(nextPending)
  }, [])

  return { shots, pending, error, loaded, refresh, replaceShotTiles, setPending }
}
