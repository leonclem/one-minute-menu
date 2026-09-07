export type StudioLibraryTab = 'shots' | 'exports'
export type StudioLibraryView = 'grid' | 'tree'

export function parseStudioLibraryTab(value: string | null | undefined): StudioLibraryTab {
  return value === 'exports' ? 'exports' : 'shots'
}

export function parseStudioLibraryView(value: string | null | undefined): StudioLibraryView {
  return value === 'tree' ? 'tree' : 'grid'
}

export function studioLibraryHref(
  dishId: string,
  tab: StudioLibraryTab,
  view: StudioLibraryView,
): string {
  const params = new URLSearchParams()
  if (tab === 'exports') params.set('tab', 'exports')
  if (tab === 'shots' && view === 'tree') params.set('view', 'tree')
  const query = params.toString()
  return query ? `/studio/${dishId}?${query}` : `/studio/${dishId}`
}

/** Workbench degradation CTA: shots tab, tree view. */
export function studioShotTreeHref(dishId: string): string {
  return `/studio/${dishId}?tab=shots&view=tree`
}
