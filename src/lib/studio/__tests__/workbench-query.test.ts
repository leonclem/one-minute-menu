import { parseStudioWorkbenchTab, replaceStudioWorkbenchUrl, studioWorkbenchHref } from '../workbench-query'

describe('studio workbench query', () => {
  it('defaults to scene and only serialises exports', () => {
    expect(parseStudioWorkbenchTab(undefined)).toBe('scene')
    expect(parseStudioWorkbenchTab('exports')).toBe('exports')
    expect(studioWorkbenchHref('d1', 'img1')).toBe('/studio/d1/img1')
    expect(studioWorkbenchHref('d1', 'img1', 'exports')).toBe('/studio/d1/img1?tab=exports')
  })

  it('rewrites the workbench URL without replacing the current history entry twice', () => {
    const replaceState = jest.spyOn(window.history, 'replaceState')
    window.history.replaceState({}, '', '/studio/d1/img1')
    replaceState.mockClear()

    replaceStudioWorkbenchUrl('/studio/d1/img1')
    expect(replaceState).not.toHaveBeenCalled()

    replaceStudioWorkbenchUrl('/studio/d1/img2')
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState.mock.calls[0]?.[2]).toBe('/studio/d1/img2')
    replaceState.mockRestore()
  })
})
