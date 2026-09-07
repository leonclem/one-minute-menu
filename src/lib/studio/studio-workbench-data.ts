import { notFound } from 'next/navigation'

import { getStudioDish, listStudioDishes } from '@/lib/studio/dishes'
import { listStudioImagesForDish } from '@/lib/studio/library'
import { loadStudioPageSession, type StudioPageSession } from '@/lib/studio/studio-page-session'
import type { StudioDishRecord, StudioImageRecord } from '@/lib/studio/types'

export type StudioWorkbenchPageData =
  | { kind: 'gated' }
  | {
      kind: 'ready'
      session: StudioPageSession
      dishes: StudioDishRecord[]
      gallery: StudioImageRecord[]
      dish: StudioDishRecord
    }

export async function loadStudioWorkbenchPageData(dishId: string): Promise<StudioWorkbenchPageData> {
  const session = await loadStudioPageSession()
  if (session.gate !== 'editor') return { kind: 'gated' }

  const dish = await getStudioDish(session.userId, dishId)
  if (!dish) notFound()

  const [dishes, gallery] = await Promise.all([
    listStudioDishes(session.userId),
    listStudioImagesForDish(session.userId, dishId),
  ])

  return { kind: 'ready', session, dishes, gallery, dish }
}
