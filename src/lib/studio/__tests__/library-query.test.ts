/**
 * @jest-environment node
 */

import {
  parseStudioLibraryTab,
  parseStudioLibraryView,
  studioLibraryHref,
  studioShotTreeHref,
} from '../library-query'

describe('studio library query', () => {
  it('defaults to shots grid and only serialises non-defaults', () => {
    expect(parseStudioLibraryTab(undefined)).toBe('shots')
    expect(parseStudioLibraryTab('exports')).toBe('exports')
    expect(parseStudioLibraryView('tree')).toBe('tree')
    expect(studioLibraryHref('d1', 'shots', 'grid')).toBe('/studio/d1')
    expect(studioLibraryHref('d1', 'shots', 'tree')).toBe('/studio/d1?view=tree')
    expect(studioLibraryHref('d1', 'exports', 'grid')).toBe('/studio/d1?tab=exports')
    expect(studioShotTreeHref('d1')).toBe('/studio/d1?tab=shots&view=tree')
    expect(parseStudioLibraryTab('shots')).toBe('shots')
    expect(parseStudioLibraryView('tree')).toBe('tree')
  })
})
