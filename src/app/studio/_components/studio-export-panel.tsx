'use client'

/**
 * Photo Studio — Export Variants panel.
 *
 * An asset-pack builder: every MVP export format is always visible as a tile,
 * derived deterministically from the approved hero image where possible and
 * generated on demand where AI work is genuinely required.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import { downloadImage } from '@/lib/studio/client-download'
import { trackStudioEvent } from '@/lib/studio/analytics/studio-analytics'
import {
  buildExportFilename,
  formatExportCreditLabel,
  getExportPreset,
  type StudioExportStatus,
  type StudioExportVariantType,
} from '@/lib/studio/export-presets'
import type { StudioExportTile } from '@/lib/studio/types'

import { StudioImageLightbox } from './studio-image-lightbox'

interface ExportsResponse {
  sourceImageId: string
  dishId: string
  source: { width: number; height: number } | null
  tiles: StudioExportTile[]
  pending?: boolean
  credits?: { balance: number }
}

interface GenerateResponse {
  queued?: boolean
  tile: StudioExportTile | null
  tiles: StudioExportTile[]
  pending?: boolean
  credits?: { cost: number; balanceAfter: number }
}

/** Matches the polling cadence used by the menu-side generation status hook. */
const POLL_INTERVAL_MS = 6000

interface StudioExportPanelProps {
  /** The approved hero image exports are derived from. */
  sourceImageId: string | null
  /** Human-readable label for the selected source image, supplied by the Workbench. */
  sourceImageLabel?: string
  /** Briefly highlights the automatically updated export context after variant selection. */
  contextFlash?: boolean
  dishName?: string | null
  /** True while the editor is mid-upload/extract/generate. */
  editorBusy?: boolean
  /** Generations for this dish are paused. */
  dishBlocked?: boolean
  creditBalance: number | null
  onCreditBalanceChange?: (balance: number) => void
}

const STATUS_LABEL: Record<StudioExportStatus, string> = {
  empty: 'Not generated',
  queued: 'Queued',
  generating: 'Generating…',
  ready: 'Ready',
  failed: 'Generation failed',
}

const STATUS_DOT: Record<StudioExportStatus, string> = {
  empty: 'bg-gray-300',
  queued: 'bg-amber-400',
  generating: 'bg-amber-400 animate-pulse',
  ready: 'bg-emerald-500',
  failed: 'bg-rose-500',
}

const CHECKERBOARD =
  'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 12px 12px'

function methodLabel(tile: StudioExportTile): string {
  switch (tile.generationMethod) {
    case 'crop_resize':
      return 'Resize'
    case 'ai_expand':
      return 'AI expand'
    case 'ai_recompose':
      return 'AI recompose'
    case 'cutout':
      return 'Cut-out'
    default:
      return 'Export'
  }
}

export function StudioExportPanel({
  sourceImageId,
  sourceImageLabel = 'selected image',
  contextFlash = false,
  dishName,
  editorBusy = false,
  dishBlocked = false,
  creditBalance,
  onCreditBalanceChange,
}: StudioExportPanelProps) {
  const [tiles, setTiles] = useState<StudioExportTile[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Tiles with an in-flight POST, before the server row reflects it. */
  const [submitting, setSubmitting] = useState<Set<StudioExportVariantType>>(new Set())
  const [tileErrors, setTileErrors] = useState<
    Partial<Record<StudioExportVariantType, string>>
  >({})
  const [expanded, setExpanded] = useState<StudioExportTile | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [contextEntryCue, setContextEntryCue] = useState(false)
  const requestIdRef = useRef(0)
  const sectionRef = useRef<HTMLElement>(null)
  const previousSourceImageIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const previousSourceImageId = previousSourceImageIdRef.current
    previousSourceImageIdRef.current = sourceImageId
    setContextEntryCue(false)

    // The first image establishes the panel. Later selections should draw
    // attention when this panel is actually visible, including after a user
    // scrolls to it on a narrower screen.
    if (
      previousSourceImageId === undefined ||
      previousSourceImageId === sourceImageId ||
      !sourceImageId ||
      !sectionRef.current ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    let timeout: number | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setContextEntryCue(true)
        timeout = window.setTimeout(() => setContextEntryCue(false), 1800)
      },
      { threshold: 0.2 },
    )
    observer.observe(sectionRef.current)

    return () => {
      observer.disconnect()
      if (timeout !== undefined) window.clearTimeout(timeout)
    }
  }, [sourceImageId])

  const readyTiles = useMemo(
    () => tiles.filter((tile) => tile.status === 'ready' && tile.previewUrl),
    [tiles],
  )

  // Paid formats run on the background worker, so the panel polls until every
  // tile reaches a terminal state.
  const pending = useMemo(
    () => tiles.some((tile) => tile.status === 'queued' || tile.status === 'generating'),
    [tiles],
  )

  const loadTiles = useCallback(
    async (imageId: string, options?: { silent?: boolean }) => {
      const requestId = ++requestIdRef.current
      if (!options?.silent) setLoading(true)
      setLoadError(null)
      try {
        const response = await fetch(
          `/api/studio/exports?sourceImageId=${encodeURIComponent(imageId)}`,
        )
        const payload = (await response.json()) as ExportsResponse & { error?: string }
        if (requestId !== requestIdRef.current) return
        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load export formats')
        }
        setTiles(payload.tiles ?? [])
        if (typeof payload.credits?.balance === 'number') {
          onCreditBalanceChange?.(payload.credits.balance)
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        // A failed poll should not wipe tiles the user can still act on.
        if (!options?.silent) setTiles([])
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load export formats',
        )
      } finally {
        if (requestId === requestIdRef.current && !options?.silent) setLoading(false)
      }
    },
    [onCreditBalanceChange],
  )

  useEffect(() => {
    if (!sourceImageId || !pending) return

    const interval = window.setInterval(() => {
      void loadTiles(sourceImageId, { silent: true })
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [loadTiles, pending, sourceImageId])

  useEffect(() => {
    setTileErrors({})
    setSubmitting(new Set())
    if (!sourceImageId) {
      requestIdRef.current += 1
      setTiles([])
      setLoadError(null)
      setLoading(false)
      return
    }
    void loadTiles(sourceImageId)
  }, [loadTiles, sourceImageId])

  const setTileSubmitting = useCallback(
    (variantType: StudioExportVariantType, active: boolean) => {
      setSubmitting((prev) => {
        const next = new Set(prev)
        if (active) next.add(variantType)
        else next.delete(variantType)
        return next
      })
    },
    [],
  )

  const handleGenerate = useCallback(
    async (tile: StudioExportTile) => {
      if (!sourceImageId) return

      setTileSubmitting(tile.variantType, true)
      setTileErrors((prev) => ({ ...prev, [tile.variantType]: undefined }))
      setTiles((prev) =>
        prev.map((item) =>
          item.variantType === tile.variantType
            ? { ...item, status: 'generating', errorMessage: null }
            : item,
        ),
      )

      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_EXPORT_GENERATION_STARTED, {
        surface: 'studio',
        variant_type: tile.variantType,
        generation_method: tile.generationMethod,
        credit_cost: tile.estimatedCredits,
      })

      const startedAt = Date.now()
      try {
        const response = await fetch('/api/studio/exports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceImageId,
            variantType: tile.variantType,
          }),
        })
        const payload = (await response.json()) as GenerateResponse & {
          error?: string
          code?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? 'Export generation failed')
        }

        setTiles(payload.tiles ?? [])
        if (typeof payload.credits?.balanceAfter === 'number') {
          onCreditBalanceChange?.(payload.credits.balanceAfter)
        }

        // A queued variant is not finished — the worker owns it from here and
        // the polling effect reports the outcome.
        trackStudioEvent(
          payload.queued
            ? ANALYTICS_EVENTS.STUDIO_EXPORT_GENERATION_STARTED
            : ANALYTICS_EVENTS.STUDIO_EXPORT_GENERATION_COMPLETED,
          {
            surface: 'studio',
            outcome: payload.queued ? 'queued' : 'success',
            variant_type: tile.variantType,
            generation_method: tile.generationMethod,
            credit_cost: payload.credits?.cost ?? tile.estimatedCredits,
            credit_balance_after: payload.credits?.balanceAfter,
            duration_ms: Date.now() - startedAt,
          },
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Export generation failed'
        setTileErrors((prev) => ({ ...prev, [tile.variantType]: message }))
        setTiles((prev) =>
          prev.map((item) =>
            item.variantType === tile.variantType
              ? { ...item, status: 'failed', errorMessage: message }
              : item,
          ),
        )
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_EXPORT_GENERATION_FAILED, {
          surface: 'studio',
          outcome: 'failure',
          variant_type: tile.variantType,
          generation_method: tile.generationMethod,
          duration_ms: Date.now() - startedAt,
        })
      } finally {
        setTileSubmitting(tile.variantType, false)
      }
    },
    [onCreditBalanceChange, setTileSubmitting, sourceImageId],
  )

  const handleDownload = useCallback(
    async (tile: StudioExportTile) => {
      const preset = getExportPreset(tile.variantType)
      if (!tile.previewUrl || !preset) return
      try {
        await downloadImage(tile.previewUrl, buildExportFilename(preset, dishName))
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_EXPORT_DOWNLOADED, {
          surface: 'studio',
          variant_type: tile.variantType,
          generation_method: tile.generationMethod,
        })
      } catch {
        setTileErrors((prev) => ({
          ...prev,
          [tile.variantType]: 'Download failed. Try again.',
        }))
      }
    },
    [dishName],
  )

  const handleDownloadAll = useCallback(async () => {
    setDownloadingAll(true)
    try {
      for (const tile of readyTiles) {
        await handleDownload(tile)
      }
    } finally {
      setDownloadingAll(false)
    }
  }, [handleDownload, readyTiles])

  const handleExpand = useCallback((tile: StudioExportTile) => {
    setExpanded(tile)
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_EXPORT_EXPANDED, {
      surface: 'studio',
      variant_type: tile.variantType,
    })
  }, [])

  /**
   * One generation at a time. The worker serialises the real work anyway, and
   * this keeps the credit cost of a click unambiguous.
   */
  const anyInFlight = submitting.size > 0 || pending

  return (
    <section
      ref={sectionRef}
      id="studio-export-panel"
      className={[
        'flex h-full flex-col overflow-hidden rounded-lg border border-black/[0.08] bg-white/95 shadow-md transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none',
        (contextFlash || contextEntryCue) && 'studio-export-context-flash',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="studio-export-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b bg-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">
            Export variants
          </h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-ux-primary" aria-live="polite">
            For {sourceImageLabel}
          </p>
        </div>
        {readyTiles.length > 1 && (
          <button
            type="button"
            disabled={downloadingAll}
            className="text-xs font-bold uppercase tracking-wide text-ux-primary hover:underline disabled:cursor-not-allowed disabled:text-gray-400"
            onClick={() => void handleDownloadAll()}
          >
            {downloadingAll ? 'Downloading…' : `Download all (${readyTiles.length})`}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 p-3">
        {!sourceImageId ? (
          <p className="px-1 py-4 text-sm text-gray-500" data-testid="studio-exports-empty">
            Upload or select a dish photo to prepare channel-ready exports.
          </p>
        ) : loading ? (
          <p className="px-1 py-4 text-sm text-gray-500">Loading export formats…</p>
        ) : loadError ? (
          <div className="space-y-2 px-1 py-3">
            <p role="alert" className="text-sm text-red-800">
              {loadError}
            </p>
            <button
              type="button"
              className="text-xs font-bold uppercase tracking-wide text-ux-primary hover:underline"
              onClick={() => void loadTiles(sourceImageId)}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <p className="px-1 text-xs text-gray-600">
              Resized formats are included. Credits apply only when a format needs AI
              work.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="studio-export-grid">
              {tiles.map((tile) => {
                const inFlightLocally = submitting.has(tile.variantType)
                const status: StudioExportStatus = inFlightLocally
                  ? 'generating'
                  : tile.status
                const inFlight =
                  inFlightLocally || status === 'queued' || status === 'generating'
                const isReady = status === 'ready' && Boolean(tile.previewUrl)
                const transparent = tile.fileType === 'png'
                const error = tileErrors[tile.variantType] ?? tile.errorMessage
                const blockedReason = dishBlocked
                  ? 'Generations for this dish are paused.'
                  : !tile.available
                    ? tile.unavailableReason
                    : creditBalance !== null &&
                        tile.estimatedCredits > 0 &&
                        creditBalance < tile.estimatedCredits
                      ? 'Not enough credits for this format.'
                      : null
                const canGenerate =
                  !inFlight && !editorBusy && !anyInFlight && blockedReason === null

                return (
                  <li
                    key={tile.variantType}
                    // Sharp-edged tiles: the export grid should read as an asset
                    // grid, not as generic rounded SaaS cards.
                    className="flex flex-col border border-black/10 bg-white"
                    data-testid={`studio-export-tile-${tile.variantType}`}
                  >
                    <div className="border-b border-black/[0.06] px-3 py-2">
                      <p className="truncate text-xs font-bold uppercase tracking-wide text-ux-text">
                        {tile.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {tile.width} × {tile.height} ({tile.aspectRatio}) ·{' '}
                        {tile.fileType.toUpperCase()}
                      </p>
                    </div>

                    {isReady && tile.previewUrl ? (
                      <button
                        type="button"
                        className="group relative block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary"
                        style={transparent ? { background: CHECKERBOARD } : undefined}
                        aria-label={`Expand ${tile.label} preview`}
                        onClick={() => handleExpand(tile)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tile.previewUrl}
                          alt={`${tile.label} export preview`}
                          className="h-24 w-full object-contain p-1.5"
                        />
                        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/40 text-[11px] font-bold uppercase tracking-wide text-white group-hover:flex">
                          Expand
                        </span>
                      </button>
                    ) : (
                      <div
                        className="flex h-24 items-center justify-center border-b border-black/[0.06] bg-neutral-50 px-2 text-center text-[11px] text-gray-400"
                        aria-hidden={status !== 'generating'}
                      >
                        {inFlight ? (
                          <span className="font-semibold text-ux-primary">
                            {status === 'queued' ? 'Queued…' : 'Generating…'}
                          </span>
                        ) : (
                          <span>{tile.aspectRatio}</span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-1 flex-col gap-2 p-2.5">
                      {/*
                        Status and cost sit on separate lines. Combining them
                        overflows the tile width and truncates the credit label,
                        which is the one thing that must never be ambiguous.
                      */}
                      <div className="space-y-0.5 text-[11px] leading-tight">
                        <p className="flex items-center gap-1.5 text-gray-700">
                          <span
                            aria-hidden
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
                          />
                          <span>{STATUS_LABEL[status]}</span>
                        </p>
                        {!inFlight && (
                          <p className="pl-3 text-gray-500">
                            {isReady
                              ? tile.creditsCharged && tile.creditsCharged > 0
                                ? formatExportCreditLabel(tile.creditsCharged)
                                : 'included'
                              : `${methodLabel(tile)} · ${formatExportCreditLabel(
                                  tile.estimatedCredits,
                                )}`}
                          </p>
                        )}
                      </div>

                      {error && status === 'failed' && (
                        <p role="alert" className="text-[11px] text-red-800">
                          {error}
                        </p>
                      )}
                      {blockedReason && status !== 'ready' && (
                        <p className="text-[11px] text-amber-800">{blockedReason}</p>
                      )}

                      <div className="mt-auto space-y-1.5">
                        {isReady ? (
                          <>
                            <button
                              type="button"
                              className="w-full bg-ux-primary px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:opacity-90"
                              onClick={() => void handleDownload(tile)}
                            >
                              Download
                            </button>
                            <div className="flex gap-1.5">
                              <a
                                href={tile.previewUrl ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 border border-ux-primary px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-ux-primary hover:bg-ux-primary/5"
                              >
                                Open
                              </a>
                              <button
                                type="button"
                                disabled={!canGenerate}
                                className="flex-1 border border-gray-300 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => void handleGenerate(tile)}
                              >
                                Redo
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={!canGenerate}
                            className="w-full bg-ux-primary px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                            onClick={() => void handleGenerate(tile)}
                          >
                            {status === 'queued'
                              ? 'Queued…'
                              : status === 'generating'
                                ? 'Generating…'
                                : status === 'failed'
                                  ? 'Retry'
                                  : 'Generate'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <StudioImageLightbox
        open={expanded !== null}
        imageUrl={expanded?.previewUrl ?? null}
        title={expanded?.label ?? ''}
        subtitle={
          expanded
            ? `${expanded.width} × ${expanded.height} (${expanded.aspectRatio}) · ${expanded.fileType.toUpperCase()}`
            : undefined
        }
        transparent={expanded?.fileType === 'png'}
        onClose={() => setExpanded(null)}
      />
    </section>
  )
}
