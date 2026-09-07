/**
 * @jest-environment node
 */

import { parseStudioWorkbenchTab, studioWorkbenchHref } from '../workbench-query'

describe('studio workbench query', () => {
  it('defaults to scene and only serialises exports', () => {
    expect(parseStudioWorkbenchTab(undefined)).toBe('scene')
    expect(parseStudioWorkbenchTab('exports')).toBe('exports')
    expect(studioWorkbenchHref('d1', 'img1')).toBe('/studio/d1/img1')
    expect(studioWorkbenchHref('d1', 'img1', 'exports')).toBe('/studio/d1/img1?tab=exports')
  })
})
