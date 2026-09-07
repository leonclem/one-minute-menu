'use client'

import Link from 'next/link'
import { useCallback, useEffect, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'

import { shotShortLabel } from '@/lib/studio/lineage'
import type { StudioImageRecord } from '@/lib/studio/types'
import type { StudioWorkbenchTab } from '@/lib/studio/workbench-query'

import { StudioShotFilmstrip } from './studio-shot-filmstrip'
import { StudioWorkbenchDock } from './studio-workbench-dock'
import { StudioWorkbenchToolbar } from './studio-workbench-toolbar'

interface StudioShotWorkbenchProps {
  dishId: string
  dishName: string
  shotTitle: string
  notices: ReactNode
  canvas: ReactNode
  cropPanel: ReactNode
  removePanel: ReactNode
  scene: ReactNode
  exports: ReactNode
  tab: StudioWorkbenchTab
  onTab: (tab: StudioWorkbenchTab) => void
  sceneCount: number
  exportsCount: number
  images: readonly StudioImageRecord[]
  selectedId: string | null
  filmstripDisabled?: boolean
  onSelectShot: (image: StudioImageRecord) => void
  onDeleteShot: (image: StudioImageRecord) => void
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  toolsDisabled: boolean
  cropOpen: boolean
  objectEditOpen: boolean
  creditLabel: string
  onReframe: () => void
  onRemove: () => void
  expanded?: boolean
  onCloseExpand?: () => void
}

export function StudioShotWorkbench({
  dishId,
  dishName,
  shotTitle,
  notices,
  canvas,
  cropPanel,
  removePanel,
  scene,
  exports,
  tab,
  onTab,
  sceneCount,
  exportsCount,
  images,
  selectedId,
  filmstripDisabled,
  onSelectShot,
  onDeleteShot,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  toolsDisabled,
  cropOpen,
  objectEditOpen,
  creditLabel,
  onReframe,
  onRemove,
  expanded = false,
  onCloseExpand,
}: StudioShotWorkbenchProps) {
  const selected = images.find((image) => image.id === selectedId) ?? null
  const navDisabled = Boolean(filmstripDisabled)
  const selectedShortLabel = selected ? shotShortLabel(selected, images) : ''

  const closeExpand = useCallback(() => {
    onCloseExpand?.()
  }, [onCloseExpand])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeExpand()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeExpand, expanded])

  return (
    <div data-testid="studio-shot-workbench">
      <div className="mb-4 min-w-0">
        <Link href={`/studio/${dishId}`} className="studio-link text-sm font-semibold">
          {dishName}
        </Link>
        <h1 className="mt-1 truncate text-xl font-extrabold tracking-[-0.03em] text-white">
          {shotTitle}
        </h1>
      </div>

      {notices}

      {expanded ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/80"
          aria-label="Close expanded preview"
          onClick={closeExpand}
        />
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-stretch">
        <div
          className={
            expanded
              ? 'fixed inset-2 z-50 flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[#0c1416] shadow-2xl sm:inset-3'
              : 'flex min-h-0 min-w-0 flex-col gap-2'
          }
          data-testid={expanded ? 'studio-workbench-expand' : undefined}
          role={expanded ? 'dialog' : undefined}
          aria-modal={expanded ? true : undefined}
          aria-label={expanded ? `${selectedShortLabel} ${shotTitle}`.trim() : undefined}
        >
          <div className={expanded ? 'absolute inset-0' : 'relative'}>
            {canvas}
            <div className="pointer-events-none absolute left-3 top-3 z-20">
              <div className="pointer-events-auto flex gap-1.5">
                <button
                  type="button"
                  className="studio-overlay-btn"
                  disabled={navDisabled || !hasPrev}
                  aria-label="Previous shot"
                  onClick={onPrev}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className="studio-overlay-btn"
                  disabled={navDisabled || !hasNext}
                  aria-label="Next shot"
                  onClick={onNext}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className="studio-overlay-btn"
                  data-kind="destroy"
                  disabled={navDisabled || !selected}
                  aria-label="Delete shot"
                  onClick={() => {
                    if (selected) onDeleteShot(selected)
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden strokeWidth={2.25} />
                </button>
              </div>
            </div>
            {expanded ? (
              <>
                <div className="pointer-events-none absolute inset-x-24 top-3 z-20 flex justify-center">
                  <div className="min-w-0 max-w-md truncate rounded-[9px] bg-[rgba(12,20,22,0.72)] px-2.5 py-1 text-center backdrop-blur-md">
                    {selectedShortLabel ? (
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">
                        {selectedShortLabel}
                      </p>
                    ) : null}
                    <p className="truncate text-sm font-bold text-white">{shotTitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="studio-overlay-btn studio-overlay-btn-wide absolute right-3 top-3 z-20"
                  onClick={closeExpand}
                >
                  Close
                </button>
                <div className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2">
                  <div className="pointer-events-auto">
                    <StudioWorkbenchToolbar
                      disabled={toolsDisabled}
                      overlay
                      cropOpen={cropOpen}
                      objectEditOpen={objectEditOpen}
                      creditLabel={creditLabel}
                      onReframe={onReframe}
                      onRemove={onRemove}
                    />
                  </div>
                </div>
                {cropPanel || removePanel ? (
                  <StudioWorkbenchDock>
                    {cropPanel}
                    {removePanel}
                  </StudioWorkbenchDock>
                ) : null}
              </>
            ) : null}
          </div>
          {expanded ? null : (
            <>
              <StudioWorkbenchToolbar
                disabled={toolsDisabled}
                cropOpen={cropOpen}
                objectEditOpen={objectEditOpen}
                creditLabel={creditLabel}
                onReframe={onReframe}
                onRemove={onRemove}
              />
              {cropPanel}
              {removePanel}
              <StudioShotFilmstrip
                images={images}
                selectedId={selectedId}
                disabled={filmstripDisabled}
                onSelect={onSelectShot}
                onDelete={onDeleteShot}
              />
            </>
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[16px] border border-white/[0.1] bg-[#0f1c1f] xl:max-h-[min(42rem,calc(100dvh-13rem))]">
          <div role="tablist" aria-label="Shot panels" className="studio-tabs shrink-0 px-4">
            <button
              type="button"
              role="tab"
              className="studio-tab"
              aria-selected={tab === 'scene'}
              onClick={() => onTab('scene')}
            >
              Scene
              <span className="studio-tab-count">{sceneCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              className="studio-tab"
              aria-selected={tab === 'exports'}
              onClick={() => onTab('exports')}
            >
              Exports
              <span className="studio-tab-count">{exportsCount}</span>
            </button>
          </div>
          <div className="min-h-0 max-h-[min(28rem,55dvh)] xl:max-h-none xl:flex-1 xl:overflow-hidden">
            <div
              role="tabpanel"
              hidden={tab !== 'scene'}
              className={tab === 'scene' ? 'h-full' : 'hidden'}
            >
              {scene}
            </div>
            <div
              role="tabpanel"
              hidden={tab !== 'exports'}
              className={tab === 'exports' ? 'h-full' : 'hidden'}
            >
              {exports}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
