import { StudioClient } from './studio-client'
import { loadStudioWorkbenchPageData } from '@/lib/studio/studio-workbench-data'

export async function StudioWorkbenchRoute({
  dishId,
  preferredImageId,
  initialTab,
}: {
  dishId: string
  preferredImageId?: string
  initialTab?: string
}) {
  const data = await loadStudioWorkbenchPageData(dishId)
  if (data.kind !== 'ready') return null

  return (
    <StudioClient
      reason={data.session.accessReason}
      accessMode={data.session.accessMode}
      creditBalance={data.session.creditBalance}
      dishes={data.dishes}
      gallery={data.gallery}
      initialActiveDishId={data.dish.id}
      preferredImageId={preferredImageId}
      initialTab={initialTab}
      studioFirstRunDismissed={data.session.studioFirstRunDismissed}
      isAdmin={data.session.isAdmin}
    />
  )
}
