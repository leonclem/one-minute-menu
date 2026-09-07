'use client'

/**
 * Photo Studio — Export Variants panel.
 *
 * An asset-pack builder: every MVP export format is always visible as a tile,
 * derived deterministically from the approved hero image where possible and
 * generated on demand where AI work is genuinely required.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Info } from 'lucide-react'

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

import { StudioExpandablePreview } from './studio-expandable-preview'
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
  dishName?: string | null
  /** True while the editor is mid-upload/extract/generate. */
  editorBusy?: boolean
  /** Generations for this dish are paused. */
  dishBlocked?: boolean
  creditBalance: number | null
  onCreditBalanceChange?: (balance: number) => void
  /** Ready-file count for the workbench Exports tab badge. */
  onReadyCountChange?: (count: number) => void
}

function methodHint(tile: StudioExportTile): string {
  switch (tile.generationMethod) {
    case 'crop_resize':
      return 'free resize'
    case 'ai_expand':
    case 'ai_recompose':
    case 'cutout':
      return 'needs AI fill'
    default:
      return 'export'
  }
}

function statusLine(status: StudioExportStatus, tile: StudioExportTile): string {
  if (status === 'ready') return 'Ready'
  if (status === 'queued') return 'Queued'
  if (status === 'generating') return 'Generating…'
  if (status === 'failed') return 'Generation failed'
  return `Not made · ${methodHint(tile)}`
}

function compactCreditLabel(credits: number): string {
  return credits > 0 ? `${credits} cr` : 'free'
}

function aspectBoxSize(width: number, height: number, max = 48): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: max, height: max }
  const ratio = width / height
  if (ratio >= 1) return { width: max, height: Math.max(28, Math.round(max / ratio)) }
  return { width: Math.max(28, Math.round(max * ratio)), height: max }
}

const MAKE_ACTION_CLASS =
  'inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#01b3bf] px-3 py-1.5 text-[11px] font-bold text-[#0c1416] hover:bg-[#018f99] disabled:cursor-not-allowed disabled:opacity-40'

const DOWNLOAD_ICON_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f8bc02] text-[#03272a] hover:brightness-95'

function ActionLabel({
  label,
  creditLabel,
}: {
  label: string
  creditLabel: string | null
}) {
  if (!creditLabel) return label
  return (
    <>
      {label}
      <span className="font-semibold opacity-90">· {creditLabel}</span>
    </>
  )
}

function generateActionCopy(
  status: StudioExportStatus,
  creditCost: number,
): { label: string; creditLabel: string | null } {
  if (status === 'queued') return { label: 'Queued…', creditLabel: null }
  if (status === 'generating') return { label: 'Generating…', creditLabel: null }
  return {
    label: status === 'failed' ? 'Retry' : 'Make',
    creditLabel: compactCreditLabel(creditCost),
  }
}

export function StudioExportPanel({
  sourceImageId,
  sourceImageLabel = 'selected image',
  dishName,
  editorBusy = false,
  dishBlocked = false,
  creditBalance,
  onCreditBalanceChange,
  onReadyCountChange,
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
  const [creditsHelpOpen, setCreditsHelpOpen] = useState(false)
  const requestIdRef = useRef(0)

  const readyTiles = useMemo(
    () => tiles.filter((tile) => tile.status === 'ready' && tile.previewUrl),
    [tiles],
  )

  useEffect(() => {
    onReadyCountChange?.(readyTiles.length)
  }, [onReadyCountChange, readyTiles.length])

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
      id="studio-export-panel"
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="studio-export-panel"
    >
      <div className="shrink-0 px-3 pt-1 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs leading-5 text-white/55">
            Files made from <span className="font-bold text-white/80">this</span> shot. Each
            preview is the true shape of the file.
          </p>
          <button
            type="button"
            aria-expanded={creditsHelpOpen}
            aria-controls="studio-export-credits-help"
            aria-label="Why some export formats use credits"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/80"
            onClick={() => setCreditsHelpOpen((open) => !open)}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          Exports for {sourceImageLabel}
        </p>
        {readyTiles.length > 1 && (
          <button
            type="button"
            disabled={downloadingAll}
            className="mt-1 text-xs font-bold text-[#5fd3da] hover:underline disabled:cursor-not-allowed disabled:text-white/30"
            onClick={() => void handleDownloadAll()}
          >
            {downloadingAll ? 'Downloading…' : `Download all (${readyTiles.length})`}
          </button>
        )}
        {creditsHelpOpen && (
          <p
            id="studio-export-credits-help"
            role="note"
            className="mt-2 text-xs leading-5 text-white/55"
          >
            Credits are charged when a format needs AI — expanding the canvas to a
            new aspect ratio, or cutting the dish out of its background. A straight
            resize or crop doesn&apos;t need AI and therefore no credits are required.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {!sourceImageId ? (
          <p className="px-1 py-4 text-sm text-white/40" data-testid="studio-exports-empty">
            Upload or select a dish photo to prepare channel-ready exports.
          </p>
        ) : loading ? (
          <p className="px-1 py-4 text-sm text-white/40">Loading export formats…</p>
        ) : loadError ? (
          <div className="space-y-2 px-1 py-3">
            <p role="alert" className="text-sm text-[#ff8a80]">
              {loadError}
            </p>
            <button
              type="button"
              className="text-xs font-bold text-[#5fd3da] hover:underline"
              onClick={() => void loadTiles(sourceImageId)}
            >
              Retry
            </button>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="studio-export-list">
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
              const generateCopy = generateActionCopy(status, tile.estimatedCredits)
              const generateAriaLabel = generateCopy.creditLabel
                ? `${generateCopy.label}, ${generateCopy.creditLabel}`
                : generateCopy.label
              const redoAriaLabel =
                tile.estimatedCredits > 0
                  ? `Regenerate ${tile.label}, ${formatExportCreditLabel(tile.estimatedCredits)}`
                  : `Regenerate ${tile.label}`
              const box = aspectBoxSize(tile.width, tile.height)

              return (
                <li
                  key={tile.variantType}
                  className="flex items-center gap-3 rounded-[14px] bg-white/[0.04] px-3 py-2.5"
                  data-testid={`studio-export-tile-${tile.variantType}`}
                >
                  {isReady && tile.previewUrl ? (
                    <div
                      className="shrink-0 overflow-hidden rounded-[6px]"
                      style={{ width: box.width, height: box.height }}
                    >
                      <StudioExpandablePreview
                        src={tile.previewUrl}
                        expandLabel={`Expand ${tile.label} preview`}
                        transparent={transparent}
                        className="h-full w-full"
                        imageClassName="h-full w-full object-contain"
                        onExpand={() => handleExpand(tile)}
                      />
                    </div>
                  ) : (
                    <div
                      className="flex shrink-0 items-center justify-center rounded-[6px] border border-dashed border-white/25 text-[10px] font-semibold text-white/45"
                      style={{ width: box.width, height: box.height }}
                      aria-hidden={status !== 'generating'}
                    >
                      {inFlight ? '…' : tile.aspectRatio}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{tile.label}</p>
                    <p className="truncate text-[11px] text-white/45">
                      {tile.width} × {tile.height} · {tile.aspectRatio}
                    </p>
                    <p className="truncate text-[11px] text-white/40">{statusLine(status, tile)}</p>
                    {error && status === 'failed' ? (
                      <p role="alert" className="mt-0.5 text-[11px] text-[#ff8a80]">
                        {error}
                      </p>
                    ) : null}
                    {blockedReason && status !== 'ready' ? (
                      <p className="mt-0.5 text-[11px] text-[#f8bc02]">{blockedReason}</p>
                    ) : null}
                  </div>

                  {isReady ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Download ${tile.label}`}
                        className={DOWNLOAD_ICON_CLASS}
                        onClick={() => void handleDownload(tile)}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={!canGenerate}
                        aria-label={redoAriaLabel}
                        data-testid={`studio-export-redo-${tile.variantType}`}
                        className={MAKE_ACTION_CLASS}
                        onClick={() => void handleGenerate(tile)}
                      >
                        <ActionLabel
                          label="Redo"
                          creditLabel={compactCreditLabel(tile.estimatedCredits)}
                        />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canGenerate}
                      aria-label={generateAriaLabel}
                      className={MAKE_ACTION_CLASS}
                      onClick={() => void handleGenerate(tile)}
                    >
                      <ActionLabel
                        label={generateCopy.label}
                        creditLabel={generateCopy.creditLabel}
                      />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
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
