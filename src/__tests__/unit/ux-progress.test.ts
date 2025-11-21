import { saveUXProgress, loadUXProgress, type UXFlowStep } from '@/lib/ux-progress'

describe('ux-progress helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists and restores last step per menuId', () => {
    const menuId = 'test-menu-123'
    const step: UXFlowStep = 'template'

    saveUXProgress(menuId, step)

    const stored = loadUXProgress(menuId)
    expect(stored).not.toBeNull()
    expect(stored!.menuId).toBe(menuId)
    expect(stored!.lastStep).toBe(step)
  })

  it('returns null when nothing stored', () => {
    const result = loadUXProgress('missing-menu')
    expect(result).toBeNull()
  })
})


