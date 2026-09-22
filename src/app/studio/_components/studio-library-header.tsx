'use client'

import Link from 'next/link'

import type { StudioImageRecord } from '@/lib/studio/types'

import { StudioLibraryReshoot } from './studio-library-reshoot'

interface StudioLibraryHeaderProps {
  dishId: string
  name: string
  imageCount: number
  dishCount: number
  busy: boolean
  dishBlocked: boolean
  currentImage: StudioImageRecord | null
  onRename: () => void
  onNewShot: () => void
  onDelete: () => void
  onReshootCreated: (image: StudioImageRecord) => void
}

export function StudioLibraryHeader({
  dishId,
  name,
  imageCount,
  dishCount,
  busy,
  dishBlocked,
  currentImage,
  onRename,
  onNewShot,
  onDelete,
  onReshootCreated,
}: StudioLibraryHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
            <Link href="/studio" className="studio-link shrink-0 text-sm font-semibold">
              All dishes
            </Link>
            <span aria-hidden className="text-sm text-white/30">
              /
            </span>
            <h1 className="truncate text-xl font-extrabold tracking-[-0.03em] text-white">{name}</h1>
          </nav>
          <button
            type="button"
            aria-label="Rename dish"
            className="text-sm font-bold text-[#5fd3da] hover:underline"
            disabled={busy}
            onClick={onRename}
          >
            Rename
          </button>
        </div>
        <p className="mt-1 text-sm text-white/55">
          {imageCount === 0
            ? 'Upload a photo to start this dish.'
            : 'Open a shot to edit, or export formats for every shot.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StudioLibraryReshoot
          dishId={dishId}
          sourceImage={currentImage}
          disabled={busy || dishBlocked}
          onCreated={onReshootCreated}
        />
        {imageCount > 0 ? (
          <button type="button" className="studio-btn-primary" disabled={busy} onClick={onNewShot}>
            + New shot
          </button>
        ) : null}
        {dishCount > 1 ? (
          <button type="button" className="studio-btn-destroy" disabled={busy} onClick={onDelete}>
            Delete dish
          </button>
        ) : null}
      </div>
    </div>
  )
}
