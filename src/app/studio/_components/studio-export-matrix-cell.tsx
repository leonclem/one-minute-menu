'use client'

import { Download } from 'lucide-react'

import {
  formatExportCreditLabel,
  resolveExportGenerationMethod,
  type StudioExportPreset,
} from '@/lib/studio/export-presets'
import type { StudioExportTile } from '@/lib/studio/types'

/** Common Studio output; used so column costs match a typical square hero. */
const TYPICAL_HERO = { width: 2048, height: 2048 }

export function exportAspectBoxSize(
  width: number,
  height: number,
  max = 44,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: max, height: max }
  const ratio = width / height
  if (ratio >= 1) return { width: max, height: Math.max(20, Math.round(max / ratio)) }
  return { width: Math.max(20, Math.round(max * ratio)), height: max }
}

export function ExportPresetHeader({ preset }: { preset: StudioExportPreset }) {
  const box = exportAspectBoxSize(preset.width, preset.height, 28)
  const charged = resolveExportGenerationMethod(preset, TYPICAL_HERO) !== 'crop_resize'
  const cutout = preset.key === 'transparent_cutout'
  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="flex h-9 w-full items-end justify-center">
        {cutout ? (
          <CutoutFoodGlyph />
        ) : (
          <span
            className="studio-export-aspect"
            style={{ width: box.width, height: box.height }}
            aria-hidden
          />
        )}
      </div>
      <span className="mt-2 whitespace-nowrap text-xs font-bold text-white/80">{preset.label}</span>
      <span className="mt-0.5 whitespace-nowrap text-[11px] font-medium text-white/45">
        {preset.width} × {preset.height}
      </span>
      <span
        className={[
          'mt-0.5 inline-flex items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold',
          charged ? 'text-[#01b3bf]' : 'font-medium text-white/40',
        ].join(' ')}
      >
        {charged ? (
          <>
            <span aria-hidden>✦</span>
            1 credit
          </>
        ) : (
          'free'
        )}
      </span>
    </div>
  )
}

/** Cookie-cutter silhouette: a burger reads as “food lifted off its background”. */
function CutoutFoodGlyph() {
  return (
    <svg
      data-testid="studio-export-cutout-glyph"
      viewBox="0 0 32 28"
      width="28"
      height="24"
      fill="none"
      aria-hidden
      className="text-white/45"
    >
      <path
        d="M6.5 13.5c0-5.6 4.2-9 9.5-9s9.5 3.4 9.5 9H6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12.5" cy="8.2" r="0.7" fill="currentColor" />
      <circle cx="16.8" cy="6.8" r="0.7" fill="currentColor" />
      <circle cx="20.2" cy="8.4" r="0.7" fill="currentColor" />
      <path
        d="M5.5 15.2c1.6-.9 3.1.6 4.7 0 1.6-.6 3.1.8 4.7.1 1.6-.7 3.1.7 4.7 0 1.6-.6 3.1.9 4.7.1 1.1-.5 1.9-.2 2.7 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="17.2"
        width="22"
        height="3.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 21.6h18v1.4c0 1.7-3.2 3-9 3s-9-1.3-9-3v-1.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ExportCell({
  tile,
  busy,
  disabled,
  onGenerate,
  onDownload,
}: {
  tile: StudioExportTile
  busy: boolean
  disabled: boolean
  onGenerate: () => void
  onDownload: () => void
}) {
  const box = exportAspectBoxSize(tile.width, tile.height)
  const charged = tile.estimatedCredits > 0

  if (tile.status === 'ready') {
    return (
      <button
        type="button"
        className="studio-export-slot h-8 w-8 rounded-full"
        data-state="ready"
        aria-label={`Download ${tile.label}`}
        onClick={onDownload}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
      </button>
    )
  }

  if (busy || tile.status === 'queued' || tile.status === 'generating') {
    return (
      <span
        className="studio-export-slot"
        data-state="busy"
        style={{ width: box.width, height: box.height }}
        title="Working…"
      >
        …
      </span>
    )
  }

  if (!tile.available) {
    return <span className="text-[11px] text-white/40">Unavailable</span>
  }

  const failed = tile.status === 'failed'
  return (
    <button
      type="button"
      className="studio-export-slot"
      data-state={charged ? 'credit' : 'empty'}
      style={{ width: box.width, height: box.height }}
      disabled={disabled}
      aria-label={
        failed
          ? `Retry ${tile.label}`
          : charged
            ? `Make ${tile.label}, ${formatExportCreditLabel(tile.estimatedCredits)}`
            : `Make ${tile.label}`
      }
      onClick={onGenerate}
    >
      {failed ? (
        <span className="text-[10px] font-bold">Retry</span>
      ) : charged ? (
        <span aria-hidden>✦</span>
      ) : (
        <span aria-hidden>+</span>
      )}
    </button>
  )
}
