import type { StudioDishListItem, StudioDishRecord, StudioImageRole } from '@/lib/studio/types'

export interface StudioDishListImageRow {
  id: string
  dish_id: string | null
  role: StudioImageRole
  source_image_id: string | null
  public_url: string
  created_at: string
}

export interface StudioDishReadyExportRow {
  dish_id: string
}

interface LatestDishImage {
  id: string
  createdAt: number
  url: string
}

/** Uploaded photo behind the newest shot, when that shot is an edit of a different image. */
export function originalUrlForLatestShot(
  latestId: string,
  imagesById: ReadonlyMap<string, StudioDishListImageRow>,
): string | null {
  const latest = imagesById.get(latestId)
  if (!latest) return null

  let current = latest
  const seen = new Set<string>()
  while (seen.has(current.id) === false) {
    seen.add(current.id)
    if (current.role === 'source') {
      if (current.id === latest.id || current.public_url === latest.public_url) return null
      return current.public_url
    }
    if (!current.source_image_id) return null
    const parent = imagesById.get(current.source_image_id)
    if (!parent || parent.dish_id !== current.dish_id) return null
    current = parent
  }
  return null
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Attach the newest-shot thumbnail, the upload it was edited from, shot count,
 * and ready-export count, then order dishes by the later of the dish edit time
 * and that shot's timestamp.
 */
export function attachStudioDishListStats(
  dishes: StudioDishRecord[],
  images: StudioDishListImageRow[],
  readyExports: StudioDishReadyExportRow[],
): StudioDishListItem[] {
  const shotsByDish = new Map<string, number>()
  const imagesByDish = new Map<string, Map<string, StudioDishListImageRow>>()
  const latestByDish = new Map<string, LatestDishImage>()
  for (const image of images) {
    if (!image.dish_id) continue
    shotsByDish.set(image.dish_id, (shotsByDish.get(image.dish_id) ?? 0) + 1)
    const byId = imagesByDish.get(image.dish_id) ?? new Map<string, StudioDishListImageRow>()
    byId.set(image.id, image)
    imagesByDish.set(image.dish_id, byId)
    const createdAt = timestamp(image.created_at)
    const existing = latestByDish.get(image.dish_id)
    if (!existing || createdAt >= existing.createdAt) {
      latestByDish.set(image.dish_id, { id: image.id, createdAt, url: image.public_url })
    }
  }

  const readyByDish = new Map<string, number>()
  for (const row of readyExports) {
    readyByDish.set(row.dish_id, (readyByDish.get(row.dish_id) ?? 0) + 1)
  }

  const listed = dishes.map((dish) => {
    const latest = latestByDish.get(dish.id)
    const byId = imagesByDish.get(dish.id)
    return {
      ...dish,
      current_image_url: latest?.url ?? null,
      original_image_url: latest && byId ? originalUrlForLatestShot(latest.id, byId) : null,
      shotCount: shotsByDish.get(dish.id) ?? 0,
      readyExportCount: readyByDish.get(dish.id) ?? 0,
    }
  })

  return listed
    .map((dish, index) => ({ dish, index }))
    .sort((a, b) => {
      const aActivity = Math.max(timestamp(a.dish.updated_at), latestByDish.get(a.dish.id)?.createdAt ?? 0)
      const bActivity = Math.max(timestamp(b.dish.updated_at), latestByDish.get(b.dish.id)?.createdAt ?? 0)
      if (bActivity !== aActivity) return bActivity - aActivity
      return a.index - b.index
    })
    .map(({ dish }) => dish)
}

export function dishGridStatusText(dish: Pick<StudioDishListItem, 'shotCount' | 'readyExportCount'>): string {
  if (dish.shotCount === 0) return 'No photo yet'
  const shotLabel = dish.shotCount === 1 ? '1 shot' : `${dish.shotCount} shots`
  const fileLabel =
    dish.readyExportCount === 1 ? '1 file ready' : `${dish.readyExportCount} files ready`
  return `${shotLabel} · ${fileLabel}`
}
