'use client'

import type { StudioLibraryTab, StudioLibraryView } from '@/lib/studio/library-query'

interface StudioLibraryTabsProps {
  tab: StudioLibraryTab
  view: StudioLibraryView
  shotCount: number
  exportCount: number
  onTab: (tab: StudioLibraryTab) => void
  onView: (view: StudioLibraryView) => void
}

export function StudioLibraryTabs({
  tab,
  view,
  shotCount,
  exportCount,
  onTab,
  onView,
}: StudioLibraryTabsProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div role="tablist" aria-label="Dish library" className="studio-tabs">
        <button
          type="button"
          role="tab"
          className="studio-tab"
          aria-selected={tab === 'shots'}
          onClick={() => onTab('shots')}
        >
          Shots
          <span className="studio-tab-count">{shotCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          className="studio-tab"
          aria-selected={tab === 'exports'}
          onClick={() => onTab('exports')}
        >
          Exports
          <span className="studio-tab-count">{exportCount}</span>
        </button>
      </div>
      {tab === 'shots' ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="studio-btn-ghost"
            aria-current={view === 'grid' ? 'true' : undefined}
            onClick={() => onView('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            className="studio-btn-ghost"
            aria-current={view === 'tree' ? 'true' : undefined}
            onClick={() => onView('tree')}
          >
            Tree
          </button>
        </div>
      ) : null}
    </div>
  )
}
