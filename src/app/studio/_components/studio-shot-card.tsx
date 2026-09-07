'use client'

import Link from 'next/link'

import { shotSubtitle, shotTitle } from '@/lib/studio/lineage'
import type { StudioExportTile, StudioImageRecord } from '@/lib/studio/types'

import { StudioShotBadges, StudioShotExportTicks } from './studio-shot-meta'

interface StudioShotCardProps {
  dishId: string
  image: StudioImageRecord
  images: readonly StudioImageRecord[]
  tiles?: StudioExportTile[]
}

export function StudioShotCard({ dishId, image, images, tiles = [] }: StudioShotCardProps) {
  const title = shotTitle(image, images)
  const subtitle = shotSubtitle(image)
  const workbenchHref = `/studio/${dishId}/${image.id}`

  return (
    <article className="studio-dish-card">
      <Link href={workbenchHref} className="block overflow-hidden bg-black/20">
        <div className="aspect-[4/5]">
          {/* User storage URLs vary by env; skip the Next optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.public_url} alt="" className="h-full w-full object-cover" />
        </div>
      </Link>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <StudioShotBadges image={image} images={images} />
          <h3 className="mt-1 truncate text-sm font-bold text-white">{title}</h3>
          <p
            className="mt-0.5 h-4 truncate text-xs leading-4 text-white/40"
            data-testid="studio-shot-card-subtitle"
          >
            {subtitle || '\u00a0'}
          </p>
        </div>
        <div className="mt-auto flex shrink-0 items-center justify-between gap-2">
          <StudioShotExportTicks tiles={tiles} />
          <Link
            href={workbenchHref}
            className="studio-btn-primary shrink-0 whitespace-nowrap px-2.5 py-1 text-xs"
          >
            Branch here
          </Link>
        </div>
      </div>
    </article>
  )
}
