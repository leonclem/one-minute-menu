export type StudioWorkbenchTab = 'scene' | 'exports'

export function parseStudioWorkbenchTab(
  value: string | null | undefined,
): StudioWorkbenchTab {
  return value === 'exports' ? 'exports' : 'scene'
}

export function studioWorkbenchHref(
  dishId: string,
  imageId: string,
  tab: StudioWorkbenchTab = 'scene',
): string {
  const path = `/studio/${dishId}/${imageId}`
  return tab === 'exports' ? `${path}?tab=exports` : path
}
