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

/** Update the workbench URL without a Next.js navigation (avoids remounting the page). */
export function replaceStudioWorkbenchUrl(href: string): void {
  if (typeof window === 'undefined') return
  const current = `${window.location.pathname}${window.location.search}`
  if (current === href) return
  window.history.replaceState(window.history.state ?? {}, '', href)
}
