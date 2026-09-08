/**
 * Shot lineage for Studio: roots, generative depth, titles, and neighbours.
 *
 * GEN n counts AI re-renders from that photo’s root. Crops (`metadata.mode ===
 * 'crop'`) are lossless and do not increment depth.
 */

import { readChangeSummary } from '@/lib/studio/change-summary'
import { expandPresetLabel, readExpandPreset } from '@/lib/studio/expand'
import type { StudioImageRecord } from '@/lib/studio/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Array.isArray(value) === false
}

export function isLosslessShot(image: StudioImageRecord): boolean {
  return image.metadata?.mode === 'crop'
}

export function chronologicalShots(images: readonly StudioImageRecord[]): StudioImageRecord[] {
  return [...images].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function indexById(images: readonly StudioImageRecord[]): Map<string, StudioImageRecord> {
  return new Map(images.map((image) => [image.id, image]))
}

/** Uploads (`role === 'source'`), oldest first. */
export function sourceRoots(images: readonly StudioImageRecord[]): StudioImageRecord[] {
  return chronologicalShots(images).filter((image) => image.role === 'source')
}

/**
 * Forest roots: source uploads, plus generated shots whose parent is missing.
 */
export function shotRoots(images: readonly StudioImageRecord[]): StudioImageRecord[] {
  const byId = indexById(images)
  return chronologicalShots(images).filter((image) => {
    if (image.role === 'source' || !image.source_image_id) return true
    return byId.has(image.source_image_id) === false
  })
}

export function lineageRoot(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): StudioImageRecord {
  const byId = indexById(images)
  let current = image
  const seen = new Set<string>()
  while (current.source_image_id && seen.has(current.id) === false) {
    seen.add(current.id)
    const parent = byId.get(current.source_image_id)
    if (!parent) break
    current = parent
  }
  return current
}

/** Human label for a source upload: Original, then Upload 2, Upload 3… */
export function sourceRootLabel(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): string {
  const sources = sourceRoots(images)
  const index = sources.findIndex((source) => source.id === image.id)
  if (index <= 0) return 'Original'
  return `Upload ${index + 1}`
}

/**
 * AI re-renders between this shot and its root. Crop nodes do not add a hop.
 */
export function generativeDepth(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): number {
  const byId = indexById(images)
  let depth = 0
  let current: StudioImageRecord | undefined = image
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    if (current.role === 'generated' && isLosslessShot(current) === false) {
      depth += 1
    }
    if (!current.source_image_id) break
    current = byId.get(current.source_image_id)
  }
  return depth
}

export function deepestBranchGen(images: readonly StudioImageRecord[]): number {
  return images.reduce((max, image) => Math.max(max, generativeDepth(image, images)), 0)
}

/** Filmstrip badge: OG, U2, G1, G2… Depth 0 generated crops stay OG. */
export function shotShortLabel(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): string {
  if (image.role === 'source') {
    const sources = sourceRoots(images)
    const index = sources.findIndex((source) => source.id === image.id)
    return index <= 0 ? 'OG' : `U${index + 1}`
  }
  const depth = generativeDepth(image, images)
  return depth === 0 ? 'OG' : `G${depth}`
}

function cropAspectLabel(metadata: Record<string, unknown>): string | null {
  const crop = metadata.crop
  if (!isRecord(crop)) return null
  const preset = crop.aspectPreset
  if (typeof preset !== 'string' || preset === 'original' || preset === 'free') return null
  return preset
}

function objectEditOperation(metadata: Record<string, unknown>): string | null {
  const objectEdit = metadata.objectEdit
  if (!isRecord(objectEdit)) return null
  return typeof objectEdit.operation === 'string' ? objectEdit.operation : null
}

export function shotTitle(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): string {
  if (image.role === 'source') {
    return sourceRootLabel(image, images)
  }
  if (isLosslessShot(image)) {
    const aspect = cropAspectLabel(image.metadata)
    return aspect ? `Cropped ${aspect}` : 'Cropped'
  }
  if (image.metadata?.mode === 'expand') {
    const preset = readExpandPreset(image.metadata)
    return preset ? `Expanded · ${expandPresetLabel(preset)}` : 'Expanded'
  }
  if (image.metadata?.mode === 'reshoot') return 'Re-shot'
  const summary = readChangeSummary(image.metadata)
  if (summary[0]) return summary[0]
  if (objectEditOperation(image.metadata) === 'remove') return 'Removed object'
  const depth = generativeDepth(image, images)
  return depth > 0 ? `Generation ${depth}` : 'Generated'
}

/** Lineage badge: ORIGINAL, UPLOAD n, or GEN n. Crops keep the parent’s GEN. */
export function shotLibraryBadge(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): string {
  if (image.role === 'source') {
    const label = sourceRootLabel(image, images)
    return label === 'Original' ? 'ORIGINAL' : label.toUpperCase()
  }
  const depth = generativeDepth(image, images)
  return depth === 0 ? 'ORIGINAL' : `GEN ${depth}`
}

/** Compact label for tables: `GEN 2 · LOSSLESS` when the shot is a reframe. */
export function shotLibraryBadgeLine(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): string {
  const lineage = shotLibraryBadge(image, images)
  return isLosslessShot(image) ? `${lineage} · LOSSLESS` : lineage
}

export function shotSubtitle(image: StudioImageRecord): string {
  if (image.role === 'source') return 'Uploaded photo'
  if (isLosslessShot(image)) return 'Lossless reframe'
  const summary = readChangeSummary(image.metadata)
  if (summary.length > 1) return summary.slice(1).join(' · ')
  return ''
}

export interface ShotTreeNode {
  image: StudioImageRecord
  children: ShotTreeNode[]
}

/** Parent/child forest in chronological order within each sibling group. */
export function shotForest(images: readonly StudioImageRecord[]): ShotTreeNode[] {
  const byId = indexById(images)
  const children = new Map<string, StudioImageRecord[]>()

  for (const image of chronologicalShots(images)) {
    if (image.source_image_id && byId.has(image.source_image_id)) {
      const siblings = children.get(image.source_image_id) ?? []
      siblings.push(image)
      children.set(image.source_image_id, siblings)
    }
  }

  function toNode(image: StudioImageRecord): ShotTreeNode {
    return {
      image,
      children: (children.get(image.id) ?? []).map(toNode),
    }
  }

  return shotRoots(images).map(toNode)
}

export function neighboringShots(
  imageId: string,
  images: readonly StudioImageRecord[],
): { prev: StudioImageRecord | null; next: StudioImageRecord | null } {
  const ordered = chronologicalShots(images)
  const index = ordered.findIndex((image) => image.id === imageId)
  if (index < 0) return { prev: null, next: null }
  return {
    prev: ordered[index - 1] ?? null,
    next: ordered[index + 1] ?? null,
  }
}
