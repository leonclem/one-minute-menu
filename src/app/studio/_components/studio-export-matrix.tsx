'use client'

import { useCallback, useMemo, useState } from 'react'
import { Download } from 'lucide-react'

import { downloadImage } from '@/lib/studio/client-download'
import {
  buildExportFilename,
  EXPORT_PRESETS,
  getExportPreset,
} from '@/lib/studio/export-presets'
import { chronologicalShots, shotLibraryBadgeLine, shotTitle } from '@/lib/studio/lineage'
import type { StudioDishExportShot, StudioExportTile, StudioImageRecord } from '@/lib/studio/types'

import { ExportCell, ExportPresetHeader } from './studio-export-matrix-cell'
import { StudioImageLightbox } from './studio-image-lightbox'

interface StudioExportMatrixProps {
  dishName: string
  images: readonly StudioImageRecord[]
  shots: StudioDishExportShot[]
  dishBlocked?: boolean
  onReplaceShotTiles: (
    imageId: string,
    tiles: StudioExportTile[],
    pending?: boolean,
  ) => void
}

export function StudioExportMatrix({
  dishName,
  images,
  shots,
  dishBlocked = false,
  onReplaceShotTiles,
}: StudioExportMatrixProps) {
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [preview, setPreview] = useState<StudioImageRecord | null>(null)

  const ordered = useMemo(() => chronologicalShots(images), [images])
  const tilesByImage = useMemo(
    () => new Map(shots.map((shot) => [shot.imageId, shot.tiles])),
    [shots],
  )

  const readyTiles = useMemo(() => {
    const list: { url: string; filename: string }[] = []
    for (const image of ordered) {
      for (const tile of tilesByImage.get(image.id) ?? []) {
        if (tile.status === 'ready' && tile.previewUrl) {
          const preset = getExportPreset(tile.variantType)
          if (!preset) continue
          list.push({
            url: tile.previewUrl,
            filename: buildExportFilename(preset, `${dishName}-${shotTitle(image, images)}`),
          })
        }
      }
    }
    return list
  }, [dishName, images, ordered, tilesByImage])

  const handleGenerate = useCallback(
    async (imageId: string, tile: StudioExportTile) => {
      if (dishBlocked || !tile.available) return
      const key = `${imageId}:${tile.variantType}`
      setSubmitting(key)
      setActionError(null)
      try {
        const res = await fetch('/api/studio/exports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceImageId: imageId, variantType: tile.variantType }),
        })
        const data = (await res.json().catch(() => null)) as {
          error?: string
          tiles?: StudioExportTile[]
          pending?: boolean
        } | null
        if (!res.ok) throw new Error(data?.error ?? 'Export failed')
        if (data?.tiles) onReplaceShotTiles(imageId, data.tiles, data.pending)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Export failed')
      } finally {
        setSubmitting(null)
      }
    },
    [dishBlocked, onReplaceShotTiles],
  )

  const handleDownload = useCallback(async (image: StudioImageRecord, tile: StudioExportTile) => {
    if (!tile.previewUrl) return
    const preset = getExportPreset(tile.variantType)
    if (!preset) return
    await downloadImage(
      tile.previewUrl,
      buildExportFilename(preset, `${dishName}-${shotTitle(image, images)}`),
    )
  }, [dishName, images])

  const handleDownloadAll = useCallback(async () => {
    setDownloadingAll(true)
    setActionError(null)
    try {
      for (const item of readyTiles) {
        await downloadImage(item.url, item.filename)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloadingAll(false)
    }
  }, [readyTiles])

  if (ordered.length === 0) {
    return <p className="text-sm text-white/55">Upload a shot before exporting.</p>
  }

  return (
    <div data-testid="studio-export-matrix">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-white/55">
          Every shot against every format. Tap an empty cell to make that file. The outline is the
          shape of the file you get.
        </p>
        {readyTiles.length > 1 ? (
          <button
            type="button"
            className="studio-credits-pill"
            disabled={downloadingAll}
            onClick={() => void handleDownloadAll()}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {downloadingAll ? 'Downloading…' : `Download all ready (${readyTiles.length})`}
          </button>
        ) : null}
      </div>
      {actionError ? (
        <p role="alert" className="mb-3 text-sm text-[#ff8a80]">
          {actionError}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-[16px] border border-white/[0.1]">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/[0.1] bg-white/[0.03]">
              <th className="px-3 py-3 align-top text-left">
                <div className="flex flex-col items-start">
                  <div className="h-9" aria-hidden />
                  <span
                    data-testid="studio-export-shot-heading"
                    className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-white"
                  >
                    Shot
                  </span>
                </div>
              </th>
              {EXPORT_PRESETS.map((preset) => (
                <th key={preset.key} className="px-2 py-3 align-top">
                  <ExportPresetHeader preset={preset} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((image) => {
              const title = shotTitle(image, images)
              const badge = shotLibraryBadgeLine(image, images)
              return (
                <tr key={image.id} className="border-b border-white/[0.07] last:border-0">
                  <th className="px-3 py-2.5">
                    <div className="flex min-w-[12rem] max-w-[16rem] items-center gap-2.5">
                      <button
                        type="button"
                        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[7px] bg-black/30 ring-1 ring-white/10 hover:ring-[#5fd3da]"
                        aria-label={`Preview ${title}`}
                        title="Preview this shot"
                        onClick={() => setPreview(image)}
                      >
                        {/* User storage URLs vary by env; skip the Next optimizer. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.public_url} alt="" className="h-full w-full object-cover" />
                      </button>
                      <div className="min-w-0 text-left">
                        <div className="truncate font-semibold text-white">{title}</div>
                        <div className="truncate text-[11px] font-medium text-white/40">{badge}</div>
                      </div>
                    </div>
                  </th>
                  {(tilesByImage.get(image.id) ?? []).map((tile) => {
                    const key = `${image.id}:${tile.variantType}`
                    const busy = submitting === key
                    const inFlight = tile.status === 'queued' || tile.status === 'generating'
                    return (
                      <td key={tile.variantType} className="px-2 py-3 text-center">
                        <ExportCell
                          tile={tile}
                          busy={busy || inFlight}
                          disabled={dishBlocked}
                          onGenerate={() => void handleGenerate(image.id, tile)}
                          onDownload={() => void handleDownload(image, tile)}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <StudioImageLightbox
        open={preview !== null}
        imageUrl={preview?.public_url ?? null}
        title={preview ? shotTitle(preview, images) : ''}
        subtitle={preview ? shotLibraryBadgeLine(preview, images) : undefined}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
