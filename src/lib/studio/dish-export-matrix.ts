import { chronologicalShots } from '@/lib/studio/lineage'
import { getStudioCreditBalance } from '@/lib/studio/credits'
import {
  buildExportTiles,
  hasInFlightExportTiles,
  listExportVariantsForDish,
} from '@/lib/studio/export-variants'
import { listStudioImagesForDish } from '@/lib/studio/library'
import type {
  StudioDishExportShot,
  StudioExportVariantRecord,
  StudioImageRecord,
} from '@/lib/studio/types'

export function buildDishExportMatrix(
  images: readonly StudioImageRecord[],
  rows: readonly StudioExportVariantRecord[],
): StudioDishExportShot[] {
  const rowsBySource = new Map<string, StudioExportVariantRecord[]>()
  for (const row of rows) {
    const list = rowsBySource.get(row.source_image_id) ?? []
    list.push(row)
    rowsBySource.set(row.source_image_id, list)
  }

  return chronologicalShots(images).map((image) => ({
    imageId: image.id,
    tiles: buildExportTiles({
      rows: rowsBySource.get(image.id) ?? [],
      source:
        image.width && image.height
          ? { width: image.width, height: image.height }
          : null,
    }),
  }))
}

export function dishExportMatrixPending(shots: readonly StudioDishExportShot[]): boolean {
  return shots.some((shot) => hasInFlightExportTiles(shot.tiles))
}

export async function loadDishExportMatrix(
  userId: string,
  dishId: string,
): Promise<{
  dishId: string
  shots: StudioDishExportShot[]
  pending: boolean
  credits: { balance: number }
}> {
  const [images, rows, balance] = await Promise.all([
    listStudioImagesForDish(userId, dishId),
    listExportVariantsForDish(userId, dishId),
    getStudioCreditBalance(userId),
  ])
  const shots = buildDishExportMatrix(images, rows)
  return {
    dishId,
    shots,
    pending: dishExportMatrixPending(shots),
    credits: { balance },
  }
}
