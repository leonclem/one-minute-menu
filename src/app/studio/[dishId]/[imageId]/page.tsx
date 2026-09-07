export const dynamic = 'force-dynamic'

import { StudioWorkbenchRoute } from '../../_components/studio-workbench-route'

export default async function StudioDishImagePage({
  params,
  searchParams,
}: {
  params: { dishId: string; imageId: string }
  searchParams: { tab?: string }
}) {
  return (
    <StudioWorkbenchRoute
      dishId={params.dishId}
      preferredImageId={params.imageId}
      initialTab={searchParams.tab}
    />
  )
}
