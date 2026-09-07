export const dynamic = 'force-dynamic'

import { StudioDishesHome } from './_components/studio-dishes-home'
import { listStudioDishesWithThumbnails } from '@/lib/studio/dishes'
import { loadStudioPageSession } from '@/lib/studio/studio-page-session'

export default async function StudioDishesPage() {
  const session = await loadStudioPageSession()
  if (session.gate !== 'editor') return null

  const dishes = await listStudioDishesWithThumbnails(session.userId)
  return (
    <StudioDishesHome
      dishes={dishes}
      accessMode={session.accessMode}
      accessReason={session.accessReason}
      isAdmin={session.isAdmin}
      studioFirstRunDismissed={session.studioFirstRunDismissed}
    />
  )
}
