import { buildExpandChildMetadata, readExpandLayout, readExpandPreset } from '../metadata'

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
    expect(next.expand).toEqual({ preset: 'balanced', padRatio: 0.2, layout: 'all' })
    expect(next.changeSummary).toEqual(['Expanded · Balanced'])
    expect(next.editorState).toEqual({ schema: { food_components: { main_item: 'curry' } } })
    expect(next.extractionDiagnostics).toEqual({ version: 1 })
    expect(next.finishingTouches).toEqual({ stackIds: ['coriander'], level: 1, auto: true })
    expect(next).not.toHaveProperty('objectEdit')
    expect(next).not.toHaveProperty('spatialInventoryDiagnostics')
    expect(next).not.toHaveProperty('validation')
  })

  it('titles a biased expand', () => {
    const next = buildExpandChildMetadata({
      parentMetadata: {},
      preset: 'a_little',
      padRatio: 0.1,
      layout: 'left',
    })
    expect(next.expand.layout).toBe('left')
    expect(next.changeSummary).toEqual(['Expanded · Left · A little wider'])
  })

  it('titles a corner expand', () => {
    const next = buildExpandChildMetadata({
      parentMetadata: {},
      preset: 'balanced',
      padRatio: 0.2,
      layout: 'top_left',
    })
    expect(next.expand.layout).toBe('top_left')
    expect(next.changeSummary).toEqual(['Expanded · Top left · Balanced'])
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

describe('readExpandLayout', () => {
  it('defaults missing or unknown layout to all', () => {
    expect(readExpandLayout({ mode: 'expand', expand: { preset: 'balanced', padRatio: 0.2 } })).toBe(
      'all',
    )
    expect(
      readExpandLayout({
        mode: 'expand',
        expand: { preset: 'balanced', padRatio: 0.2, layout: 'left' },
      }),
    ).toBe('left')
  })
})
