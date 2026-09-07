import type { StudioDishListItem, StudioDishRecord } from '@/lib/studio/types'

export interface StudioDishListImageRow {
  id: string
  dish_id: string | null
  public_url: string
}

export interface StudioDishReadyExportRow {
  dish_id: string
}

/**
 * Attach thumbnail, shot count, and ready-export count for the dishes home grid.
 */
export function attachStudioDishListStats(
  dishes: StudioDishRecord[],
  images: StudioDishListImageRow[],
  readyExports: StudioDishReadyExportRow[],
): StudioDishListItem[] {
  const shotsByDish = new Map<string, number>()
  const urlByImageId = new Map<string, string>()
  for (const image of images) {
    if (!image.dish_id) continue
    shotsByDish.set(image.dish_id, (shotsByDish.get(image.dish_id) ?? 0) + 1)
    urlByImageId.set(image.id, image.public_url)
  }

  const readyByDish = new Map<string, number>()
  for (const row of readyExports) {
    readyByDish.set(row.dish_id, (readyByDish.get(row.dish_id) ?? 0) + 1)
  }

  return dishes.map((dish) => ({
    ...dish,
    current_image_url: dish.current_image_id
      ? (urlByImageId.get(dish.current_image_id) ?? null)
      : null,
    shotCount: shotsByDish.get(dish.id) ?? 0,
    readyExportCount: readyByDish.get(dish.id) ?? 0,
  }))
}

export function dishGridStatusText(dish: Pick<StudioDishListItem, 'shotCount' | 'readyExportCount'>): string {
  if (dish.shotCount === 0) return 'No photo yet'
  const shotLabel = dish.shotCount === 1 ? '1 shot' : `${dish.shotCount} shots`
  const fileLabel =
    dish.readyExportCount === 1 ? '1 file ready' : `${dish.readyExportCount} files ready`
  return `${shotLabel} · ${fileLabel}`
}
