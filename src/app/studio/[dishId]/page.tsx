export const dynamic = 'force-dynamic'

import { StudioDishLibrary } from '../_components/studio-dish-library'
import { loadStudioWorkbenchPageData } from '@/lib/studio/studio-workbench-data'

export default async function StudioDishPage({
  params,
  searchParams,
}: {
  params: { dishId: string }
  searchParams: { tab?: string; view?: string }
}) {
  const data = await loadStudioWorkbenchPageData(params.dishId)
  if (data.kind !== 'ready') return null

  return (
    <StudioDishLibrary
      dish={data.dish}
      images={data.gallery}
      dishCount={data.dishes.length}
      initialTab={searchParams.tab}
      initialView={searchParams.view}
    />
  )
}
