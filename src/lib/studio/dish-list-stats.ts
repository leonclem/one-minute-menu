import type { StudioDishListItem, StudioDishRecord } from '@/lib/studio/types'

export interface StudioDishListImageRow {
  id: string
  dish_id: string | null
  public_url: string
  created_at: string
}

export interface StudioDishReadyExportRow {
  dish_id: string
}

interface LatestDishImage {
  createdAt: number
  url: string
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Attach the newest-shot thumbnail, shot count, and ready-export count, then
 * order dishes by the later of the dish edit time and that shot's timestamp.
 */
export function attachStudioDishListStats(
  dishes: StudioDishRecord[],
  images: StudioDishListImageRow[],
  readyExports: StudioDishReadyExportRow[],
): StudioDishListItem[] {
  const shotsByDish = new Map<string, number>()
  const latestByDish = new Map<string, LatestDishImage>()
  for (const image of images) {
    if (!image.dish_id) continue
    shotsByDish.set(image.dish_id, (shotsByDish.get(image.dish_id) ?? 0) + 1)
    const createdAt = timestamp(image.created_at)
    const existing = latestByDish.get(image.dish_id)
    if (!existing || createdAt >= existing.createdAt) {
      latestByDish.set(image.dish_id, { createdAt, url: image.public_url })
    }
  }

  const readyByDish = new Map<string, number>()
  for (const row of readyExports) {
    readyByDish.set(row.dish_id, (readyByDish.get(row.dish_id) ?? 0) + 1)
  }

  const listed = dishes.map((dish) => ({
    ...dish,
    current_image_url: latestByDish.get(dish.id)?.url ?? null,
    shotCount: shotsByDish.get(dish.id) ?? 0,
    readyExportCount: readyByDish.get(dish.id) ?? 0,
  }))

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
