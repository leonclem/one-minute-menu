import { buildExpandChildMetadata, readExpandPreset } from '../metadata'

describe('buildExpandChildMetadata', () => {
  it('copies editor JSON and drops spatial / object-edit keys', () => {
    const next = buildExpandChildMetadata({
      parentMetadata: {
        editorState: { schema: { food_components: { main_item: 'curry' } } },
        extractionDiagnostics: { version: 1 },
        finishingTouches: { stackIds: ['coriander'], level: 1, auto: true },
        objectEdit: { operation: 'remove' },
        spatialInventoryDiagnostics: { version: 1, status: 'ok' },
        validation: { status: 'pass' },
        changeSummary: ['Lighting'],
      },
      preset: 'balanced',
      padRatio: 0.2,
    })

    expect(next.mode).toBe('expand')
    expect(next.expand).toEqual({ preset: 'balanced', padRatio: 0.2 })
    expect(next.changeSummary).toEqual(['Expanded · Balanced'])
    expect(next.editorState).toEqual({ schema: { food_components: { main_item: 'curry' } } })
    expect(next.extractionDiagnostics).toEqual({ version: 1 })
    expect(next.finishingTouches).toEqual({ stackIds: ['coriander'], level: 1, auto: true })
    expect(next).not.toHaveProperty('objectEdit')
    expect(next).not.toHaveProperty('spatialInventoryDiagnostics')
    expect(next).not.toHaveProperty('validation')
  })
})

describe('readExpandPreset', () => {
  it('reads a stored expand preset', () => {
    expect(readExpandPreset({ mode: 'expand', expand: { preset: 'editorial', padRatio: 0.35 } })).toBe(
      'editorial',
    )
    expect(readExpandPreset({ mode: 'crop' })).toBeNull()
  })
})
