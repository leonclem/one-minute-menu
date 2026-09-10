'use client'

import Link from 'next/link'

import { shotForest, shotSubtitle, shotTitle, type ShotTreeNode } from '@/lib/studio/lineage'
import type { StudioExportTile, StudioImageRecord } from '@/lib/studio/types'

import { StudioShotBadges, StudioShotDeleteButton, StudioShotExportTicks } from './studio-shot-meta'

interface StudioShotTreeProps {
  dishId: string
  images: readonly StudioImageRecord[]
  tilesByImageId: ReadonlyMap<string, StudioExportTile[]>
  disabled?: boolean
  onDelete: (image: StudioImageRecord) => void
}

function TreeRow({
  node,
  dishId,
  images,
  tilesByImageId,
  disabled,
  onDelete,
}: {
  node: ShotTreeNode
  dishId: string
  images: readonly StudioImageRecord[]
  tilesByImageId: ReadonlyMap<string, StudioExportTile[]>
  disabled: boolean
  onDelete: (image: StudioImageRecord) => void
}) {
  const title = shotTitle(node.image, images)
  const subtitle = shotSubtitle(node.image)
  const workbenchHref = `/studio/${dishId}/${node.image.id}`

  return (
    <li>
      <div className="flex flex-col gap-1 rounded-[11px] px-2 py-2 hover:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href={workbenchHref}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-[9px] bg-black/20"
            data-testid="studio-shot-tree-thumb"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={node.image.public_url} alt="" className="h-full w-full object-cover" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold text-white">{title}</h3>
              <StudioShotBadges image={node.image} images={images} />
            </div>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-white/40">{subtitle}</p> : null}
          </div>
        </div>
        <div className="ml-[4.5rem] flex shrink-0 items-center gap-2 sm:ml-0">
          <div className="hidden sm:block">
            <StudioShotExportTicks tiles={tilesByImageId.get(node.image.id)} />
          </div>
          <div className="studio-tree-actions">
            <Link
              href={workbenchHref}
              className="studio-btn-primary studio-tree-branch"
            >
              Branch here
            </Link>
            <StudioShotDeleteButton
              disabled={disabled}
              className="studio-overlay-btn studio-tree-delete"
              onClick={() => onDelete(node.image)}
            />
          </div>
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="ml-7 mt-1 space-y-0.5 border-l-2 border-[#01b3bf]/45 pl-3">
          {node.children.map((child) => (
            <TreeRow
              key={child.image.id}
              node={child}
              dishId={dishId}
              images={images}
              tilesByImageId={tilesByImageId}
              disabled={disabled}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function StudioShotTree({
  dishId,
  images,
  tilesByImageId,
  disabled = false,
  onDelete,
}: StudioShotTreeProps) {
  const forest = shotForest(images)

  if (forest.length === 0) return null

  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-white/40">
        Each row is a shot. Indentation is the parent it was generated from. GEN counts AI
        re-renders; reframes stay lossless.
      </p>
      <ul
        className="space-y-1 rounded-[16px] border border-white/[0.1] bg-[#0f1c1f] p-2 sm:p-3"
        data-testid="studio-shot-tree"
      >
        {forest.map((node) => (
          <TreeRow
            key={node.image.id}
            node={node}
            dishId={dishId}
            images={images}
            tilesByImageId={tilesByImageId}
            disabled={disabled}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  )
}
