'use client'

import { useEffect, useRef, useState } from 'react'

export const KITCHEN_LOADER_CLIPS = {
  kitchen: {
    src: '/studio/ui/kitchen-loader.svg',
    loopStartS: 0.85,
    loopEndS: 6.7,
    stillS: 2.2,
    playbackRate: 0.5,
  },
  'frying-pan': {
    src: '/studio/ui/frying-pan-loader.svg',
    loopStartS: 0,
    loopEndS: 3.017,
    stillS: 1.1,
    playbackRate: 1,
  },
  egg: {
    src: '/studio/ui/egg-loader.svg',
    loopStartS: 0,
    loopEndS: 1.467,
    stillS: 0.35,
    playbackRate: 1,
  },
} as const

export type KitchenLoaderClipId = keyof typeof KITCHEN_LOADER_CLIPS
export type KitchenLoaderClip = (typeof KITCHEN_LOADER_CLIPS)[KitchenLoaderClipId]

export const KITCHEN_LOADER_CLIP_IDS = Object.keys(KITCHEN_LOADER_CLIPS) as KitchenLoaderClipId[]

const STATUS_LABEL = {
  uploading: 'Uploading photo…',
  extracting: 'Analysing photo…',
  generating: 'Generating…',
} as const

export type StudioCanvasBusyMode = keyof typeof STATUS_LABEL

const markupCache = new Map<string, Promise<string>>()

export function pickKitchenLoaderClipId(random: () => number = Math.random): KitchenLoaderClipId {
  const index = Math.min(
    KITCHEN_LOADER_CLIP_IDS.length - 1,
    Math.max(0, Math.floor(random() * KITCHEN_LOADER_CLIP_IDS.length)),
  )
  return KITCHEN_LOADER_CLIP_IDS[index]
}

export function nextKitchenLoaderTime(
  currentTime: number,
  clip: KitchenLoaderClip = KITCHEN_LOADER_CLIPS.kitchen,
): number {
  if (
    !Number.isFinite(currentTime) ||
    currentTime < clip.loopStartS ||
    currentTime >= clip.loopEndS
  ) {
    return clip.loopStartS
  }
  return currentTime
}

export function advanceKitchenLoaderTime(
  currentTime: number,
  deltaSeconds: number,
  clip: KitchenLoaderClip = KITCHEN_LOADER_CLIPS.kitchen,
): number {
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
  return nextKitchenLoaderTime(currentTime + delta * clip.playbackRate, clip)
}

function loadClipMarkup(src: string): Promise<string> {
  let pending = markupCache.get(src)
  if (!pending) {
    pending = fetch(src)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Kitchen loader SVG could not be loaded')
        }
        return response.text()
      })
      .catch((error) => {
        markupCache.delete(src)
        throw error
      })
    markupCache.set(src, pending)
  }
  return pending
}

export function preloadKitchenLoaderSvg(): Promise<string[]> {
  return Promise.all(KITCHEN_LOADER_CLIP_IDS.map((id) => loadClipMarkup(KITCHEN_LOADER_CLIPS[id].src)))
}

export function resetKitchenLoaderMarkupCache() {
  markupCache.clear()
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function StudioCookingLoader({
  svgMarkup,
  clipId,
}: {
  svgMarkup?: string
  clipId?: KitchenLoaderClipId
}) {
  const [pickedId] = useState<KitchenLoaderClipId>(() => clipId ?? pickKitchenLoaderClipId())
  const clip = KITCHEN_LOADER_CLIPS[clipId ?? pickedId]
  const hostRef = useRef<HTMLDivElement>(null)
  const [markup, setMarkup] = useState(svgMarkup ?? '')

  useEffect(() => {
    if (svgMarkup) {
      setMarkup(svgMarkup)
      return
    }
    let cancelled = false
    loadClipMarkup(clip.src)
      .then((text) => {
        if (!cancelled) setMarkup(text)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [clip.src, svgMarkup])

  useEffect(() => {
    const svg = hostRef.current?.querySelector('svg')
    if (!svg || typeof svg.setCurrentTime !== 'function') return

    svg.pauseAnimations()

    if (prefersReducedMotion()) {
      svg.setCurrentTime(clip.stillS)
      return
    }

    let playhead: number = clip.loopStartS
    let lastFrame = performance.now()
    svg.setCurrentTime(playhead)
    let frame = 0
    const tick = (now: number) => {
      playhead = advanceKitchenLoaderTime(playhead, (now - lastFrame) / 1000, clip)
      lastFrame = now
      svg.setCurrentTime(playhead)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [clip, markup])

  if (!markup) return null

  return (
    <div
      ref={hostRef}
      className="h-[min(21rem,90%)] w-[min(21rem,90%)]"
      data-testid="studio-cooking-loader"
      data-clip={clipId ?? pickedId}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

export function StudioCanvasBusyOverlay({ mode }: { mode: StudioCanvasBusyMode }) {
  const label = STATUS_LABEL[mode]

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-[16px] border border-[#01b3bf]/30 bg-[#0c1416]/70 text-sm text-[#5fd3da] backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      {mode === 'generating' ? (
        <>
          <StudioCookingLoader />
          <span className="sr-only">{label}</span>
        </>
      ) : (
        label
      )}
    </div>
  )
}
